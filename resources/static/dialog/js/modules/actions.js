/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Modules.Actions = (function() {
  "use strict";

  var bid = BrowserID,
      sc,
      serviceManager = bid.module,
      user = bid.User,
      errors = bid.Errors,
      mediator = bid.Mediator,
      dialogHelpers = bid.Helpers.Dialog,
      runningService,
      onsuccess;

  function startService(name, options, reported_service_name) {
    mediator.publish("service", { name: reported_service_name || name });

    // Only one service outside of the main dialog allowed.
    if(runningService) {
      serviceManager.stop(runningService);
    }

    var module = serviceManager.start(name, options);
    if(module) {
      runningService = name;
    }

    return module;
  }

  function startRegCheckService(options, verifier, message) {
    var controller = startService("check_registration", {
      verifier: verifier,
      verificationMessage: message,
      siteName: options.siteName,
      email: options.email
    });
    controller.startCheck();
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(data) {
      var self=this;

      data = data || {};

      onsuccess = data.onsuccess;

      sc.start.call(self, data);

      if(data.ready) _.defer(data.ready);
    },

    doCancel: function() {
      if(onsuccess) onsuccess(null);
    },

    doSetPassword: function(info) {
      startService("set_password", info);
    },

    doStageUser: function(info) {
      dialogHelpers.createUser.call(this, info.email, info.password, info.ready);
    },

    doConfirmUser: function(info) {
      startRegCheckService.call(this, info, "waitForUserValidation", "user_confirmed");
    },

    doPickEmail: function(info) {
      startService("pick_email", info);
    },

    doAddEmail: function(info) {
      startService("add_email", info);
    },

    doStageEmail: function(info) {
      dialogHelpers.addSecondaryEmail.call(this, info.email, info.password, info.ready);
    },

    doConfirmEmail: function(info) {
      startRegCheckService.call(this, info, "waitForEmailValidation", "email_confirmed");
    },

    doAuthenticate: function(info) {
      startService("authenticate", info);
    },

    doAuthenticateWithUnverifiedEmail: function(info) {
      var self = this;
      dialogHelpers.authenticateUser.call(this, info.email, info.password,
          function() {
        self.publish("authenticated", info);
      });
    },

    doStageResetPassword: function(info) {
      dialogHelpers.resetPassword.call(this, info.email, info.ready);
    },

    doConfirmResetPassword: function(info) {
      startRegCheckService.call(this, info, "waitForPasswordResetComplete", "reset_password_confirmed");
    },

    doStageReverifyEmail: function(info) {
      dialogHelpers.reverifyEmail.call(this, info.email, info.ready);
    },

    doConfirmReverifyEmail: function(info) {
      startRegCheckService.call(this, info, "waitForEmailReverifyComplete", "reverify_email_confirmed");
    },

    doStageTransitionToSecondary: function(info) {
      dialogHelpers.transitionToSecondary.call(this, info.email,
          info.password, info.ready);
    },

    doConfirmTransitionToSecondary: function(info) {
      startRegCheckService.call(this, info,
          "waitForTransitionToSecondaryComplete",
          "transition_to_secondary_confirmed");
    },

    doCompleteSignIn: function(info) {
      info.ready = function() {
        onsuccess(info);
      };
      startService("complete_sign_in", info);
    },

    doNotMe: function() {
      var self=this;
      user.logoutUser(self.publish.bind(self, "logged_out"), self.getErrorDialog(errors.logoutUser));
    },

    doCheckAuth: function(info) {
      var self=this;

      info = info || {};
      user.checkAuthenticationAndSync(function (authenticated) {
        // Does the RP want us to force the user to authenticate?
        authenticated = info.forceAuthentication ? false : authenticated;
        self.publish("authentication_checked", {
          authenticated: authenticated
        });
      }, self.getErrorDialog(errors.checkAuthentication));
    },

    doProvisionPrimaryUser: function(info) {
      startService("provision_primary_user", info);
    },

    doVerifyPrimaryUser: function(info) {
      startService("verify_primary_user", info);
    },

    doPrimaryUserProvisioned: function(info) {
      startService("primary_user_provisioned", info);
    },

    doPrimaryUserNotProvisioned: function(info) {
      startService("primary_user_not_provisioned", info);
    },

    doPrimaryOffline: function(info) {
      startService("primary_offline", info);
    },

    doIsThisYourComputer: function(info) {
      startService("is_this_your_computer", info);
    },

    doGenerateAssertion: function(info) {
      startService("generate_assertion", info);
    },

    doRPInfo: function(info) {
      startService("rp_info", info);
    }
  });

  sc = Module.sc;
  return Module;

}());
