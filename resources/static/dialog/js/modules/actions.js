/*jshint browser:true, jquery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
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
      onsuccess,
      onerror;

  function startService(name, options) {
    // Only one service outside of the main dialog allowed.
    if(runningService) {
      serviceManager.stop(runningService);
    }
    var module = serviceManager.start(name, options);
    if(module) {
      runningService = name;
    }

    mediator.publish("service", { name: name });

    return module;
  }

  function startRegCheckService(options, verifier, message) {
    var controller = startService("check_registration", {
      verifier: verifier,
      verificationMessage: message,
      password: options.password,
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
      onerror = data.onerror;

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

    doAuthenticateWithRequiredEmail: function(info) {
      startService("required_email", info);
    },

    doResetPassword: function(info) {
      startService("set_password", _.extend(info, { password_reset: true }));
    },

    doStageResetPassword: function(info) {
      dialogHelpers.resetPassword.call(this, info.email, info.password, info.ready);
    },

    doConfirmResetPassword: function(info) {
      startRegCheckService.call(this, info, "waitForPasswordResetComplete", "staged_address_confirmed");
    },

    doStageReverifyEmail: function(info) {
      dialogHelpers.reverifyEmail.call(this, info.email, info.ready);
    },

    doConfirmReverifyEmail: function(info) {
      startRegCheckService.call(this, info, "waitForEmailReverifyComplete", "staged_address_confirmed");
    },

    doAssertionGenerated: function(info) {
      // Clear onerror before the call to onsuccess - the code to onsuccess
      // calls window.close, which would trigger the onerror callback if we
      // tried this afterwards.
      this.hideWait();
      dialogHelpers.animateClose(function() {
        onerror = null;
        if(onsuccess) onsuccess(info);
      });
    },

    doNotMe: function() {
      var self=this;
      user.logoutUser(self.publish.bind(self, "logged_out"), self.getErrorDialog(errors.logoutUser));
    },

    doCheckAuth: function() {
      var self=this;
      user.checkAuthenticationAndSync(function(authenticated) {
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

    doCannotVerifyRequiredPrimary: function(info) {
      this.renderError("cannot_verify_required_email", info);
    },

    doPrimaryUserProvisioned: function(info) {
      startService("primary_user_provisioned", info);
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
