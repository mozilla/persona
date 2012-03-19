/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.State = (function() {
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
    var self = this,
        handleState = self.subscribe.bind(self),
        redirectToState = mediator.publish.bind(mediator),
        startAction = function(save, msg, options) {
          if(typeof save !== "boolean") {
            options = msg;
            msg = save;
            save = true;
          }

          var func = controller[msg].bind(controller);
          self.gotoState(save, func, options);
        },
        cancelState = self.popState.bind(self);

    handleState("start", function(msg, info) {
      info = info || {};

      self.hostname = info.hostname;
      self.privacyURL = info.privacyURL;
      self.tosURL = info.tosURL;
      requiredEmail = info.requiredEmail;

      if ((typeof(requiredEmail) !== "undefined") && (!bid.verifyEmail(requiredEmail))) {
        // Invalid format
        startAction("doError", "invalid_required_email", {email: requiredEmail});
      }
      else if(info.email && info.type === "primary") {
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
      if (!self.success) {
        storage.setStagedOnBehalfOf("");
        startAction("doCancel");
      }
    });

    handleState("authentication_checked", function(msg, info) {
      var authenticated = info.authenticated;

      if (requiredEmail) {
        self.email = requiredEmail;
        startAction("doAuthenticateWithRequiredEmail", {
          email: requiredEmail,
          privacyURL: self.privacyURL,
          tosURL: self.tosURL
        });
      }
      else if (authenticated) {
        redirectToState("pick_email");
      } else {
        redirectToState("authenticate");
      }
    });

    handleState("authenticate", function(msg, info) {
      info = info || {};
      info.privacyURL = self.privacyURL;
      info.tosURL = self.tosURL;
      startAction("doAuthenticate", info);
    });

    handleState("user_staged", function(msg, info) {
      self.stagedEmail = info.email;
      info.required = !!requiredEmail;
      startAction("doConfirmUser", info);
    });

    handleState("user_confirmed", function() {
      self.email = self.stagedEmail;
      startAction("doEmailConfirmed", { email: self.stagedEmail} );
    });

    handleState("primary_user", function(msg, info) {
      addPrimaryUser = !!info.add;
      email = info.email;

      var idInfo = storage.getEmail(email);
      if(idInfo && idInfo.cert) {
        redirectToState("primary_user_ready", info);
      }
      else {
        // We don't want to put the provisioning step on the stack, instead when
        // a user cancels this step, they should go back to the step before the
        // provisioning.
        startAction(false, "doProvisionPrimaryUser", info);
      }
    });

    handleState("primary_user_provisioned", function(msg, info) {
      info = info || {};
      info.add = !!addPrimaryUser;
      startAction("doPrimaryUserProvisioned", info);
    });

    handleState("primary_user_unauthenticated", function(msg, info) {
      info = helpers.extend(info || {}, {
        add: !!addPrimaryUser,
        email: email,
        requiredEmail: !!requiredEmail,
        privacyURL: self.privacyURL,
        tosURL: self.tosURL
      });

      if(primaryVerificationInfo) {
        primaryVerificationInfo = null;
        if(requiredEmail) {
          startAction("doCannotVerifyRequiredPrimary", info);
        }
        else if(info.add) {
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
        privacyURL: self.privacyURL,
        tosURL: self.tosURL
      });
    });

    handleState("email_chosen", function(msg, info) {
      info = info || {};

      var email = info.email,
          idInfo = storage.getEmail(email);

      self.email = email;

      function oncomplete() {
        complete(info.complete);
      }

      if(idInfo) {
        if(idInfo.type === "primary") {
          if(idInfo.cert) {
            startAction("doEmailChosen", info);
          }
          else {
            // If the email is a primary, and their cert is not available,
            // throw the user down the primary flow.
            // Doing so will catch cases where the primary certificate is expired
            // and the user must re-verify with their IdP.
            redirectToState("primary_user", info);
          }
        }
        else {
          user.checkAuthentication(function(authentication) {
            if(authentication === "assertion") {
              // user must authenticate with their password, kick them over to
              // the required email screen to enter the password.
              startAction("doAuthenticateWithRequiredEmail", {
                email: email,
                secondary_auth: true,
                privacyURL: self.privacyURL,
                tosURL: self.tosURL
              });
            }
            else {
              startAction("doEmailChosen", info);
            }
            oncomplete();
          }, oncomplete);
        }
      }
      else {
        throw "invalid email";
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

    handleState("forgot_password", function(msg, info) {
      // forgot password initiates the forgotten password flow.
      startAction(false, "doForgotPassword", info);
    });

    handleState("reset_password", function(msg, info) {
      // reset password says the password has been reset, now waiting for
      // confirmation.
      startAction(false, "doResetPassword", info);
    });

    handleState("assertion_generated", function(msg, info) {
      self.success = true;
      if (info.assertion !== null) {
        if (storage.usersComputer.shouldAsk(network.userid())) {
          // We have to confirm the user's status
          self.assertion_info = info;
          redirectToState("is_this_your_computer", info);
        }
        else {
          storage.setLoggedIn(user.getOrigin(), self.email);
          startAction("doAssertionGenerated", { assertion: info.assertion, email: self.email });
        }
      }
      else {
        redirectToState("pick_email");
      }
    });

    handleState("is_this_your_computer", function(msg, info) {
      startAction("doIsThisYourComputer", info);
    });

    handleState("user_computer_status_set", function(msg, info) {
      // User's status has been confirmed, redirect them back to the
      // assertion_generated state with the stored assertion_info
      var assertion_info = self.assertion_info;
      self.assertion_info = null;
      redirectToState("assertion_generated", assertion_info);
    });

    handleState("add_email", function(msg, info) {
      info = helpers.extend(info || {}, {
        privacyURL: self.privacyURL,
        tosURL: self.tosURL
      });

      startAction("doAddEmail", info);
    });

    handleState("email_staged", function(msg, info) {
      self.stagedEmail = info.email;
      info.required = !!requiredEmail;
      startAction("doConfirmEmail", info);
    });

    handleState("email_confirmed", function() {
      startAction("doEmailConfirmed", { email: self.stagedEmail} );
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

