/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.State = (function() {
  "use strict";

  var bid = BrowserID,
      storage = bid.Storage,
      network = bid.Network,
      mediator = bid.Mediator,
      helpers = bid.Helpers,
      user = bid.User,
      moduleManager = bid.module,
      complete = bid.Helpers.complete;

  function startStateMachine() {
    /*jshint validthis: true*/
    // Self has been changed from a reference to this to a reference to the
    // current temporal state. State cannot be stored on the "this" object
    // because the user can go backwards in time using the "cancel_state"
    // action. If the state were stored on this object, we would not have an
    // easy way to "back up" in time. Because of this, snapshots of the
    // current state must be taken and stored every time a new state is
    // started. When a redirectToState is called, this is a continuation
    // of the current state and no new state object is stored.  When
    // a cancelState occurs, repopulate the state object with the previously
    // saved snapshot.
    var me = this,
        self = {},
        momentos = [],
        redirecting = false,
        handleState = function(msg, callback) {
          me.subscribe(msg, function(msg, info) {
            // Save a snapshot of the current state off to the momentos. If
            // a state is ever cancelled, this momento will be used as the
            // new state.
            if (shouldSaveMomento(msg)) momentos.push(_.extend({}, self));
            redirecting = false;

            callback(msg, info || {});
          });
        },
        redirectToState = function(msg, info) {
          // redirectToState is like continuing the current state.  Do not save
          // a momento if a redirection occurs.
          redirecting = true;
          mediator.publish(msg, info);
        },
        startAction = function(save, msg, options) {
          if (typeof save !== "boolean") {
            options = msg;
            msg = save;
            save = true;
          }

          var func = me.controller[msg].bind(me.controller);
          me.gotoState(save, func, options);
        },
        cancelState = function() {
          // A state has been cancelled, go back to the previous snapshot of
          // state.
          self = momentos.pop();
          me.popState();
        };

    function shouldSaveMomento(msg) {
      // Do not save temporal state machine state if we are cancelling
      // state or if we are redirecting. A redirection basically says
      // "continue the current state".  A "cancel_state" would put the
      // current state on the list of momentos which would then have to
      // immediately be taken back off.
      return msg !== "cancel_state" && !redirecting;
    }


    function handleEmailStaged(actionName, msg, info) {
      // The unverified email has been staged, now the user has to confirm
      // ownership of the address.  Send them off to the "verify your address"
      // screen.
      var actionInfo = {
        email: info.email,
        siteName: self.siteName
      };

      self.stagedEmail = info.email;

      // Keep these emails around until the user is actually staged.  If the
      // staging request is throttled, the next time set_password is called,
      // these variables are needed to know which staging function to call.
      // See issue #2258.
      self.newUserEmail = self.addEmailEmail = self.transitionNoPassword = null;

      startAction(actionName, actionInfo);
    }

    function handleEmailConfirmed(msg, info) {
      self.email = self.stagedEmail;

      if (info.mustAuth) {
        // If the mustAuth flag comes in, the user has to authenticate.
        // This is not a cancelable authentication.  mustAuth is set
        // after a user verifies an address but is not authenticated
        // to the password level.
        redirectToState("authenticate", {
          email: self.stagedEmail,
          email_mutable: false
        });
      }
      else {
        // if mustAuth has not come through, we can assume the user is already
        // authenticated, and this address is verified. Generate an assertion.
        // This was changed from calling email_chosen because email_chosen
        // checks the state of the address on the backend. An email address
        // that was in the transition_no_password state and then verified is
        // put into the transition_to_secondary state until an assertion is
        // generated. email_chosen sees transition_to_secondary and forces the
        // user to enter their password. Not what we want.
        redirectToState("email_valid_and_ready", { email: self.stagedEmail });
      }
    }


    /**
     * The entry point to the state machine. Users who are returning from
     * authenticating with their primary will have info.email and info.type set
     * to primary.
     */
    handleState("start", function(msg, info) {
      self.hostname = info.hostname;
      self.siteName = info.siteName || info.hostname;
      self.privacyPolicy = info.privacyPolicy;
      self.termsOfService = info.termsOfService;
      self.siteTOSPP = !!(info.privacyPolicy && info.termsOfService);

      if (info.forceIssuer) {
        user.setIssuer(info.forceIssuer);
      }

      self.allowUnverified = info.allowUnverified;
      user.setAllowUnverified(info.allowUnverified);

      /**
       * Only show the favicon on mobile devices if we are not signing in to
       * FirefoxOS marketplace. Checking isDefaultIssuer is an ugly hack,
       * but we use it in several places.
       */
      info.mobileFavicon = user.isDefaultIssuer();
      startAction(false, "doRPInfo", info);

      if (info.email && info.type === "primary") {
        // this case is where a users is returning to the dialog from
        // authentication with a primary.  Elsewhere in
        // code we key off of whether .postIdPVerificationInfo is
        // set to behave differently the first time the dialog is
        // loaded vs. when a user returns to the dialog after auth with
        // primary.
        self.postIdPVerificationInfo = info;
        redirectToState("primary_user", info);
      }
      else {
        startAction("doCheckAuth", info);
      }
    });

    handleState("cancel", function() {
      startAction("doCancel");
    });

    handleState("authentication_checked", function(msg, info) {
      var authenticated = info.authenticated;
      if (authenticated) {
        redirectToState("pick_email");
      } else {
        redirectToState("authenticate");
      }
      mediator.publish("user_can_interact");
    });

    handleState("authenticate", function(msg, info) {
      _.extend(info, {
        siteName: self.siteName,
        siteTOSPP: self.siteTOSPP,
        allowUnverified: self.allowUnverified
      });

      startAction("doAuthenticate", info);
      complete(info.complete);
    });

    handleState("new_user", function(msg, info) {
      self.newUserEmail = info.email;

      // Add new_account to the KPIs *before* the staging occurs allows us to
      // know when we are losing users due to the email verification.
      mediator.publish("kpi_data", { new_account: true });

      startAction(false, "doSetPassword", info);
      complete(info.complete);
    });

    handleState("transition_no_password", function(msg, info) {
      // In this state, the user has an account that used to consist only of
      // primary IdP addresses and the user has no password. One of the
      // IdPs no longer takes care of certifying their users so the user must
      // create a fallback IdP password.

      // If we are using the default issuer, then this is a normal
      // transitionNoPassword. If not using the default issuer, then this is
      // a FirefoxOS account. The second branch should not be used unless
      // Marketplace decides it is going to support primaries.
      if (user.isDefaultIssuer()) {
        self.transitionNoPassword = info.email;
        info.transition_no_password = true;
      }
      else {
        self.newFxAccountEmail = info.email;
        info.fxaccount = true;
      }
      startAction(false, "doSetPassword", info);
      complete(info.complete);
    });

    // B2G forceIssuer on primary
    handleState("new_fxaccount", function(msg, info) {
      self.newFxAccountEmail = info.email;

      // Add new_account to the KPIs *before* the staging occurs allows us to
      // know when we are losing users due to the email verification.
      mediator.publish("kpi_data", { new_account: true });

      info.fxaccount = true;
      startAction(false, "doSetPassword", info);
      complete(info.complete);
    });

    handleState("password_set", function(msg, info) {
      /* A password can be set for several reasons
       * 1) This is a new user
       * 2) A user is adding the first secondary address to an account that
       * consists only of primary addresses
       * 3) an existing user has forgotten their password and wants to reset it.
       * 4) A primary address was downgraded to a secondary and the user
       *    has no password in the DB.
       * 5) RP is using forceIssuer and we have a primary email address with
       * no password for the user
       * #1 is taken care of by newUserEmail, #2 by addEmailEmail, #3 by resetPasswordEmail,
       * #4 by transitionNoPassword and #5 by fxAccountEmail
       */
      info = _.extend({ email: self.newUserEmail || self.addEmailEmail ||
                               self.resetPasswordEmail || self.transitionNoPassword ||
                               self.newFxAccountEmail}, info);
      if(self.newUserEmail) {
        startAction(false, "doStageUser", info);
      }
      else if(self.addEmailEmail) {
        startAction(false, "doStageEmail", info);
      }
      else if (self.transitionNoPassword) {
        redirectToState("stage_transition_to_secondary", info);
      }
      else if(self.newFxAccountEmail) {
        startAction(false, "doStageUser", info);
      }
      complete(info.complete);
    });

    handleState("user_staged", handleEmailStaged.curry("doConfirmUser"));

    // Once an unverified user is created, skip the confirmation step and
    // sign them in directly.
    handleState("unverified_created", function(msg, info) {
      startAction(false, "doAuthenticateWithUnverifiedEmail", info);
    });

    handleState("user_confirmed", handleEmailConfirmed);

    handleState("stage_transition_to_secondary", function(msg, info) {
      startAction(false, "doStageTransitionToSecondary", info);
    });

    handleState("transition_to_secondary_staged", handleEmailStaged.curry("doConfirmTransitionToSecondary"));

    handleState("transition_to_secondary_confirmed", handleEmailConfirmed);

    handleState("primary_user", function(msg, info) {
      self.addPrimaryUser = !!info.add;
      var email = self.email = info.email,
          idInfo = storage.getEmail(email);

      if (idInfo && idInfo.cert) {
        redirectToState("primary_user_ready", info);
      }
      else {
        user.isEmailRegistered(email, function(known) {
          if (!known) {
            mediator.publish("kpi_data", { new_account: true });
          }
        });

        // We don't want to put the provisioning step on the stack,
        // instead when a user cancels this step, they should go
        // back to the step before the provisioning.
        startAction(false, "doProvisionPrimaryUser", info);
      }
    });

    handleState("primary_user_provisioned", function(msg, info) {
      // The user is is authenticated with their IdP. Two possibilities exist
      // for the email - 1) create a new account or 2) add address to the
      // existing account. If the user is authenticated with Persona, #2
      // will happen. If not, #1.
      info = info || {};
      info.add = !!self.addPrimaryUser;
      startAction("doPrimaryUserProvisioned", info);
    });

    handleState("primary_user_unauthenticated", function(msg, info) {
     /*jshint newcap:false*/
      _.extend(info, {
        add: !!self.addPrimaryUser,
        email: self.email,
        siteName: self.siteName,
        idpName: info.idpName || URLParse(info.auth_url).host
      });

      // If .postIdPVerificationInfo is set, that means the user is
      // returning to the dialog after authentication with their IdP.
      // When provisioning fails and:
      // 1. the user did not cancel - Perhaps 3rd party
      //    cookies are disabled. Show some messaging.
      // 2. it's the first provisioning attempt - we send the user to
      //    authentication with their IdP
      // 3. it's the second provisioning attempt - we sent the user back
      //    to the proper screen to pick a new email address.
      // related to issue #2339
      var postIdPVerificationInfo = self.postIdPVerificationInfo;
      if (postIdPVerificationInfo) {

        self.postIdPVerificationInfo = null;
        if (!postIdPVerificationInfo.cancelled) {
          // user did not cancel at the IdP, yet upon return, there was an
          // error. Show some messaging.
          startAction("doPrimaryUserNotProvisioned", info);
          complete(info.complete);
        }
        else if (postIdPVerificationInfo.add) {
          // Add the pick_email in case the user cancels the add_email
          // screen. The user needs something to go "back" to.
          redirectToState("pick_email");
          redirectToState("add_email", info);
        }
        else {
          redirectToState("authenticate", info);
        }
      }
      else {
        startAction("doVerifyPrimaryUser", info);
        complete(info.complete);
      }

    });

    handleState("primary_user_authenticating", function(msg, info) {
      // Keep the dialog from automatically closing when the user browses to
      // the IdP for verification.
      moduleManager.stopAll();
      me.success = self.success = true;
    });

    handleState("primary_user_ready", function(msg, info) {
      // redirect to email_chosen, which is more a general codepath,
      // ensure that it knows that this is a primary email address.
      _.extend(info, { type: "primary" });
      redirectToState("email_chosen", info);
    });

    handleState("primary_offline", function(msg, info) {
      startAction("doPrimaryOffline", info);
    });

    handleState("pick_email", function() {
      var originEmail = user.getOriginEmail();
      startAction("doPickEmail", {
        origin: self.hostname,
        privacyPolicy: !originEmail && self.privacyPolicy,
        termsOfService: !originEmail && self.termsOfService,
        siteName: self.siteName,
        hostname: self.hostname
      });
    });

    handleState("email_chosen", function(msg, info) {
      var email = info.email,
          record = user.getStoredEmailKeypair(email);

      if (!(record || info.allow_new_record)) {
        throw new Error("invalid email");
      }

      self.email = email;

      function oncomplete() {
        complete(info.complete);
      }

      /**
       * Before continuing, we make the assumption that user->syncEmails has
       * been called, the list of addresses is up to date, and any invalid
       * certs have been removed in addressInfo.
       */
      user.resetCaches();
      user.addressInfo(info.email, function(addressInfo) {
        mediator.publish("kpi_data", { email_type: addressInfo.type });

        // the cert could have been cleared by the call to addressInfo. re-load
        // the record info.
        record = user.getStoredEmailKeypair(email);

        // If a primary is offline, do not generate a cert for it because there
        // is a good chance that the RP cannot fetch the IdP's public key.
        if ('offline' === addressInfo.state) {
          redirectToState("primary_offline", addressInfo);
        }
        else if (record && record.cert) {
          // Email is valid and the cert is available - the user can log
          // in without authenticating with the IdP. All invalid/expired
          // certs are assumed to have been checked and removed by this
          // point. cert checking/removal is done in user.addressInfo
          redirectToState("email_valid_and_ready", addressInfo);
        }
        else if ("transition_to_primary" === addressInfo.state) {
          // the user's account is being upgraded, we know they do not have
          // a cert. They may be able to provision with their IdP, but we want
          // them to see a nice message. Make them verify with their primary.
          redirectToState("primary_user_unauthenticated", addressInfo);
        }
        else if (addressInfo.type === "primary") {
          // If the email is a primary and the cert is not available,
          // throw the user down the primary flow. The primary flow will
          // catch cases where the primary certificate is expired
          // and the user must re-verify with their IdP.
          redirectToState("primary_user", addressInfo);
        }
        // everything below here is a secondary of some sort.
        else if ("transition_to_secondary" === addressInfo.state) {
          // If the user is coming from the authentication screen, stage the
          // address verification, autherwise the user must enter their
          // password.
          if (info.email && info.password) {
            redirectToState("stage_transition_to_secondary", info);
          }
          else {
            addressInfo.email_mutable = false;
            redirectToState("authenticate", addressInfo);
          }
        }
        else if ("transition_no_password" === addressInfo.state) {
          redirectToState("transition_no_password", addressInfo);
        }
        else if ("unverified" === addressInfo.state && !self.allowUnverified) {
          // user selected an unverified secondary email, kick them over to the
          // verify screen.
          redirectToState("stage_reverify_email", addressInfo);
        }
        else {
          // Address is verified, check the authentication, if the user is not
          // authenticated to the assertion level, force them to enter their
          // password.
          return user.checkAuthentication(function(authentication) {
            if (authentication !== "password") {
              // user must authenticate with their password, kick them over to
              // the authenticate screen to enter the password.
              addressInfo.email_mutable = false;
              redirectToState("authenticate", addressInfo);
            }
            else {
              redirectToState("email_valid_and_ready", addressInfo);
            }
            oncomplete();
          }, oncomplete);
        }

        oncomplete();
      });
    });

    handleState("stage_reverify_email", function(msg, info) {
      // A user has selected an email that has not been verified after
      // a password reset.  Stage the email again to be re-verified.
      var actionInfo = {
        email: info.email
      };
      startAction("doStageReverifyEmail", actionInfo);
    });

    handleState("reverify_email_staged", handleEmailStaged.curry("doConfirmReverifyEmail"));

    handleState("reverify_email_confirmed", handleEmailConfirmed);

    handleState("email_valid_and_ready", function(msg, info) {
      // this state is only called after all checking is done on the email
      // address.  For secondaries, this means the email has been validated and
      // the user is authenticated to the password level.  For primaries, this
      // means the user is authenticated with their IdP and the certificate for
      // the address is valid.  An assertion can be generated, but first we
      // may have to check whether the user owns the computer.
      user.shouldAskIfUsersComputer(function(shouldAsk) {
        if (shouldAsk) {
          redirectToState("is_this_your_computer", info);
        }
        else {
          redirectToState("generate_assertion", info);
        }
      });
    });

    handleState("is_this_your_computer", function(msg, info) {
      // We have to confirm the user's computer ownership status.  Save off
      // the selected email info for when the user_computer_status_set is
      // complete so that the user can continue the flow with the correct
      // email address.
      self.chosenEmailInfo = info;
      startAction("doIsThisYourComputer", info);
    });

    handleState("user_computer_status_set", function(msg, info) {
      // User's status has been confirmed, an assertion can safely be
      // generated as there are no more delays introduced by user interaction.
      // Use the email address that was stored in the call to
      // "is_this_your_computer".
      var emailInfo = self.chosenEmailInfo;
      self.chosenEmailInfo = null;
      redirectToState("generate_assertion", emailInfo);
    });

    handleState("generate_assertion", function(msg, info) {
      startAction("doGenerateAssertion", info);
    });

    handleState("forgot_password", function(msg, info) {
      // User has forgotten their password, let them reset it.  The user will
      // be transitioned to the confirmation screen and must verify their email
      // address. The new password will be entered on the main site after the
      // user verifies their address.
      startAction(false, "doStageResetPassword", info);
      complete(info.complete);
    });

    handleState("reset_password_staged", handleEmailStaged.curry("doConfirmResetPassword"));

    handleState("assertion_generated", function(msg, info) {
      if (info.assertion !== null) {
        self.success = true;
        storage.site.set(user.getOrigin(), "logged_in", self.email);

        mediator.publish("kpi_data", { orphaned: false });
        startAction("doCompleteSignIn", {
          assertion: info.assertion,
          email: self.email
        });
      }
      else {
        redirectToState("pick_email");
      }
    });

    handleState("reset_password_confirmed", handleEmailConfirmed);

    handleState("notme", function() {
      startAction("doNotMe");
    });

    handleState("logged_out", function() {
      redirectToState("authenticate");
    });

    handleState("authenticated", function(msg, info) {
      redirectToState("email_chosen", info);
    });

    handleState("add_email", function(msg, info) {
      // add_email indicates the user wishes to add an email to the account,
      // the add_email screen must be displayed.  After the user enters the
      // email address they wish to add, add_email will trigger
      // either 1) primary_user or 2) email_staged. #1 occurs if the email
      // address is a primary address, #2 occurs if the address is a secondary
      // and the verification email has been sent.
      startAction("doAddEmail", info);
      complete(info.complete);
    });

    handleState("stage_email", function(msg, info) {
      user.passwordNeededToAddSecondaryEmail(function(passwordNeeded) {
        if(passwordNeeded) {
          self.addEmailEmail = info.email;
          startAction(false, "doSetPassword", info);
        }
        else {
          startAction(false, "doStageEmail", info);
        }

        complete(info.complete);
      });
    });

    handleState("email_staged", handleEmailStaged.curry("doConfirmEmail"));

    handleState("email_confirmed", handleEmailConfirmed);

    handleState("cancel_state", function(msg, info) {
      if (self.newUserEmail || self.newFxAccountEmail) {
        // If the user cancels from the set_password screen, they should not be
        // counted as new users.
        mediator.publish("kpi_data", { new_account: false });
      }

      cancelState(info);
    });

  }

  var State = BrowserID.StateMachine.extend({
    start: function(options) {
      var self=this;

      options = options || {};

      self.controller = options.controller;
      if (!self.controller) {
        throw new Error("start: controller must be specified");
      }

      State.sc.start.call(self, options);
      startStateMachine.call(self);
    }
  });

  return State;
}());

