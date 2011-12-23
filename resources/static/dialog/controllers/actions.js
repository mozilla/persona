/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
BrowserID.Modules.Actions = (function() {
  "use strict";

  var bid = BrowserID,
      sc,
      serviceManager = bid.module,
      user = bid.User,
      errors = bid.Errors,
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

    doAddEmail: function() {
      startService("add_email", {});
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

    doSyncThenPickEmail: function() {
      var self = this;
      user.syncEmails(self.doPickEmail.bind(self),
        self.getErrorDialog(errors.syncEmails));
    },

    doCheckAuth: function() {
      var self=this;
      user.checkAuthenticationAndSync(function onSuccess() {}, function onComplete(authenticated) {
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

    doPrimaryUserVerified: function(info) {
      startService("primary_user_verified", info);
    },

    doEmailChosen: function(info) {
      startService("email_chosen", info);
    }
  });

  sc = Module.sc;

  return Module;
}());
