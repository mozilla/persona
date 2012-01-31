/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
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
      wait = bid.Wait,
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

    return module;
  }

  function startRegCheckService(email, verifier, message) {
    this.confirmEmail = email;

    var controller = startService("check_registration", {
      email: email,
      verifier: verifier,
      verificationMessage: message
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

    /**
     * Show an error message
     * @method doError
     * @param {string} [template] - template to use, if not given, use "error"
     * @param {object} [info] - info to send to template
     */
    doError: function(template, info) {
      if(!info) {
        info = template;
        template = "error";
      }
      this.renderError(template, info);
    },

    doOffline: function() {
      this.renderError("offline", {});
    },

    doCancel: function() {
      if(onsuccess) onsuccess(null);
    },

    doConfirmUser: function(email) {
      startRegCheckService.call(this, email, "waitForUserValidation", "user_confirmed");
    },

    doPickEmail: function(info) {
      startService("pick_email", info);
    },

    doAddEmail: function(info) {
      startService("add_email", info);
    },

    doAuthenticate: function(info) {
      startService("authenticate", info);
    },

    doAuthenticateWithRequiredEmail: function(info) {
      startService("required_email", info);
    },

    doForgotPassword: function(info) {
      startService("forgot_password", info);
    },

    doResetPassword: function(info) {
      this.doConfirmUser(info.email);
    },

    doConfirmEmail: function(email) {
      startRegCheckService.call(this, email, "waitForEmailValidation", "email_confirmed");
    },

    doEmailConfirmed: function() {
      var self=this;
      // yay!  now we need to produce an assertion.
      user.getAssertion(self.confirmEmail, user.getOrigin(), function(assertion) {
        self.publish("assertion_generated", {
          assertion: assertion
        });
      }, self.getErrorDialog(errors.getAssertion));
    },

    doAssertionGenerated: function(assertion) {
      // Clear onerror before the call to onsuccess - the code to onsuccess
      // calls window.close, which would trigger the onerror callback if we
      // tried this afterwards.
      onerror = null;
      if(onsuccess) onsuccess(assertion);
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

    doPrimaryUserProvisioned: function(info) {
      startService("primary_user_provisioned", info);
    },

    doEmailChosen: function(info) {
      startService("email_chosen", info);
    }
  });

  sc = Module.sc;

  return Module;
}());
