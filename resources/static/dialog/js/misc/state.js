/*jshint browser:true, jquery: true, forin: true, laxbreak:true */
/*global BrowserID: true, URLParse: true */
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
      complete = bid.Helpers.complete,
      controller,
      addPrimaryUser = false,
      email,
      requiredEmail,
      primaryVerificationInfo;

  function startStateMachine() {
    /*jshint validthis: true*/
    var self = this,
        handleState = function(msg, callback) {
          self.subscribe(msg, function(msg, info) {
            // This level of indirection is to ensure an info object is
            // always present in the handler.
            callback(msg, info || {});
          });
        },
        redirectToState = mediator.publish.bind(mediator),
        startAction = function(save, msg, options) {
          if (typeof save !== "boolean") {
            options = msg;
            msg = save;
            save = true;
          }

          var func = controller[msg].bind(controller);
          self.gotoState(save, func, options);
        },
        cancelState = self.popState.bind(self);

    function handleEmailStaged(actionName, msg, info) {
      // The unverified email has been staged, now the user has to confirm
      // ownership of the address.  Send them off to the "verify your address"
      // screen.
      var actionInfo = {
        email: info.email,
        siteName: self.siteName
      };

      self.stagedEmail = info.email;
      startAction(actionName, actionInfo);
    }


    handleState("start", function(msg, info) {
      self.hostname = info.hostname;
      self.siteName = info.siteName || info.hostname;
      self.siteTOSPP = !!(info.privacyPolicy && info.termsOfService);

      requiredEmail = info.requiredEmail;

      startAction(false, "doRPInfo", info);

      if (info.email && info.type === "primary") {
        primaryVerificationInfo = info;
        redirectToState("primary_user", info);
      }
      else {
        startAction("doCheckAuth");
      }
    });

    handleState("cancel", function() {
      startAction("doCancel");
    });

    handleState("window_unload", function() {
      // Round up final KPI stats as the user is leaving the dialog.  This
      // ensures the final state is sent to the KPI stats.  Any new logins are
      // counted, any new sites are counted, any new emails are included, etc.
      mediator.publish("kpi_data", {
        number_emails: storage.getEmailCount() || 0,
        sites_signed_in: storage.loggedInCount() || 0,
        sites_visited: storage.site.count() || 0,
        orphaned: !self.success
     });
    });

    handleState("authentication_checked", function(msg, info) {
      var authenticated = info.authenticated;

      if (requiredEmail) {
        self.email = requiredEmail;
        startAction("doAuthenticateWithRequiredEmail", {
          email: requiredEmail,
          // New users are handled by either the "new_user" flow or the
          // "primary_user" flow. The Persona TOS/PP will be shown to users in
          // these stages.
          siteTOSPP: self.siteTOSPP && !user.getOriginEmail()
        });
      }
      else if (authenticated) {
        redirectToState("pick_email");
      } else {
        redirectToState("authenticate");
      }
    });

    handleState("authenticate", function(msg, info) {
      _.extend(info, {
        siteName: self.siteName,
        siteTOSPP: self.siteTOSPP
      });

      startAction("doAuthenticate", info);
    });

    handleState("new_user", function(msg, info) {
      self.newUserEmail = info.email;

      // Add new_account to the KPIs *before* the staging occurs allows us to
      // know when we are losing users due to the email verification.
      mediator.publish("kpi_data", { new_account: true });

      _.extend(info, {
        // cancel is disabled if the user is doing the initial password set
        // for a requiredEmail.
        cancelable: !requiredEmail,

        // New users in the requiredEmail flow are sent directly to the
        // set_password screen.  If this happens, they have not yet seen the
        // TOS/PP agreement.

        // Always show the Persona TOS/PP to new requiredEmail users.
        personaTOSPP: !!requiredEmail,

        // The site TOS/PP must be shown to new requiredEmail users if there is
        // a site TOS/PP
        siteTOSPP: !!requiredEmail && self.siteTOSPP
      });

      startAction(false, "doSetPassword", info);
    });

    handleState("password_set", function(msg, info) {
      /* A password can be set for one of three reasons - 1) This is a new user
       * or 2) a user is adding the first secondary address to an account that
       * consists only of primary addresses, or 3) an existing user has
       * forgotten their password and wants to reset it.  #1 is taken care of
       * by newUserEmail, #2 by addEmailEmail, #3 by resetPasswordEmail.
       */
      info = _.extend({ email: self.newUserEmail || self.addEmailEmail || self.resetPasswordEmail }, info);

      if(self.newUserEmail) {
        self.newUserEmail = null;
        startAction(false, "doStageUser", info);
      }
      else if(self.addEmailEmail) {
        self.addEmailEmail = null;
        startAction(false, "doStageEmail", info);
      }
      else if(self.resetPasswordEmail) {
        self.resetPasswordEmail = null;
        startAction(false, "doStageResetPassword", info);
      }
    });

    handleState("user_staged", handleEmailStaged.curry("doConfirmUser"));

    handleState("user_confirmed", function() {
      self.email = self.stagedEmail;
      redirectToState("email_chosen", { email: self.stagedEmail} );
    });

    handleState("staged_address_confirmed", function() {
      self.email = self.stagedEmail;
      redirectToState("email_chosen", { email: self.stagedEmail} );
    });

    handleState("primary_user", function(msg, info) {
      addPrimaryUser = !!info.add;
      email = info.email;

      var idInfo = storage.getEmail(email);
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
      info.add = !!addPrimaryUser;
      // The user is is authenticated with their IdP. Two possibilities exist
      // for the email - 1) create a new account or 2) add address to the
      // existing account. If the user is authenticated with BrowserID, #2
      // will happen. If not, #1.
      startAction("doPrimaryUserProvisioned", info);
    });

    handleState("primary_user_unauthenticated", function(msg, info) {
      // a user who lands here is not authenticated with their identity
      // provider.
      _.extend(info, {
        add: !!addPrimaryUser,
        email: email,
        requiredEmail: !!requiredEmail,

        // In the requiredEmail flow, a user who is not authenticated with
        // their primary will be sent directly to the "you must verify
        // with your IdP" screen.
        //
        // Show the siteTOSPP to all requiredEmail users who have never visited
        // the site before.
        siteTOSPP: requiredEmail && self.siteTOSPP && !user.getOriginEmail(),

        // Show the persona TOS/PP only to requiredEmail users who are creating
        // a new account.
        personaTOSPP: requiredEmail && !addPrimaryUser,
        siteName: self.siteName,
        idpName: info.idpName || URLParse(info.auth_url).host
      });

      if (primaryVerificationInfo) {
        primaryVerificationInfo = null;
        if (requiredEmail) {
          startAction("doCannotVerifyRequiredPrimary", info);
        }
        else if (info.add) {
          // Add the pick_email in case the user cancels the add_email screen.
          // The user needs something to go "back" to.
          redirectToState("pick_email");
          redirectToState("add_email", info);
        }
        else {
          redirectToState("authenticate", info);
        }
      }
      else {
        startAction("doVerifyPrimaryUser", info);
      }
    });

    handleState("primary_user_authenticating", function(msg, info) {
      // Keep the dialog from automatically closing when the user browses to
      // the IdP for verification.
      moduleManager.stopAll();
      self.success = true;
    });

    handleState("primary_user_ready", function(msg, info) {
      redirectToState("email_chosen", info);
    });

    handleState("pick_email", function() {
      startAction("doPickEmail", {
        origin: self.hostname,
        siteTOSPP: self.siteTOSPP && !user.getOriginEmail()
      });
    });

    handleState("email_chosen", function(msg, info) {
      var email = info.email,
          idInfo = storage.getEmail(email);

      self.email = email;

      function oncomplete() {
        complete(info.complete);
      }

      if (!idInfo) {
        throw "invalid email";
      }

      mediator.publish("kpi_data", { email_type: idInfo.type });

      if (idInfo.type === "primary") {
        if (idInfo.cert) {
          // Email is a primary and the cert is available - the user can log
          // in without authenticating with the IdP. All invalid/expired
          // certs are assumed to have been checked and removed by this
          // point.
          redirectToState("email_valid_and_ready", info);
        }
        else {
          // If the email is a primary and the cert is not available,
          // throw the user down the primary flow. The primary flow will
          // catch cases where the primary certificate is expired
          // and the user must re-verify with their IdP.
          redirectToState("primary_user", info);
        }
      }
      // Anything below this point means the address is a secondary.
      else if (!idInfo.verified) {
        // user selected an unverified secondary email, kick them over to the
        // verify screen.
        redirectToState("stage_reverify_email", info);
      }
      else {
        // Address is verified, check the authentication, if the user is not
        // authenticated to the assertion level, force them to enter their
        // password.
        user.checkAuthentication(function(authentication) {
          if (authentication === "assertion") {
             // user must authenticate with their password, kick them over to
            // the required email screen to enter the password.
            startAction("doAuthenticateWithRequiredEmail", {
              email: email,
              secondary_auth: true,

              // This is a user is already authenticated to the assertion
              // level who has chosen a secondary email address from the
              // pick_email screen. They would have been shown the
              // siteTOSPP there.
              siteTOSPP: false
            });
          }
          else {
            redirectToState("email_valid_and_ready", info);
          }
          oncomplete();
        }, oncomplete);
      }
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
      // User has forgotten their password, let them reset it.  The response
      // message from the forgot_password controller will be a set_password.
      // the set_password handler needs to know the resetPasswordEmail so it
      // knows how to trigger the reset_password_staged message.  At this
      // point, the email confirmation screen will be shown.
      self.resetPasswordEmail = info.email;
      startAction(false, "doResetPassword", info);
    });

    handleState("reset_password_staged", handleEmailStaged.curry("doConfirmResetPassword"));

    handleState("assertion_generated", function(msg, info) {
      self.success = true;
      if (info.assertion !== null) {
        storage.setLoggedIn(user.getOrigin(), self.email);

        startAction("doAssertionGenerated", { assertion: info.assertion, email: self.email });
      }
      else {
        redirectToState("pick_email");
      }
    });

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
    });

    handleState("stage_email", function(msg, info) {
      user.passwordNeededToAddSecondaryEmail(function(passwordNeeded) {
        if(passwordNeeded) {
          self.addEmailEmail = info.email;

          _.extend(info, {
            // cancel is disabled if the user is doing the initial password set
            // for a requiredEmail.
            cancelable: !requiredEmail,

            // stage_email is called to add an email to an already existing
            // account.  Since it is an already existing account, the
            // personaTOSPP does not need to be shown.
            personaTOSPP: false,

            // requiredEmail users who are adding an email but must set their
            // password will be redirected here without seeing any other
            // screens. non-requiredEmail users will have already seen the site
            // TOS/PP in the pick-email screen if it was necessary.  Since
            // requiredEmail users may not have seen the screen before, show it
            // here if there is no originEmail.
            siteTOSPP: self.siteTOSPP && requiredEmail && !user.getOriginEmail()
          });

          startAction(false, "doSetPassword", info);
        }
        else {
          startAction(false, "doStageEmail", info);
        }

        complete(info.complete);
      });
    });

    handleState("email_staged", handleEmailStaged.curry("doConfirmEmail"));

    handleState("email_confirmed", function() {
      redirectToState("email_chosen", { email: self.stagedEmail } );
    });

    handleState("cancel_state", function(msg, info) {
      cancelState(info);
    });

  }

  var State = BrowserID.StateMachine.extend({
    start: function(options) {
      options = options || {};

      controller = options.controller;
      if (!controller) {
        throw "start: controller must be specified";
      }

      addPrimaryUser = false;
      email = requiredEmail = null;

      State.sc.start.call(this, options);
      startStateMachine.call(this);
    }
  });

  return State;
}());

