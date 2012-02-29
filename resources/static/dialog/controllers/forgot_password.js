/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID:true, PageController: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.ForgotPassword = (function() {
  "use strict";

  var ANIMATION_TIME = 250,
      bid = BrowserID,
      helpers = bid.Helpers,
      dialogHelpers = helpers.Dialog,
      dom = bid.DOM;

  function resetPassword() {
    var self=this;
    dialogHelpers.resetPassword.call(self, self.email);
  }

  function cancelResetPassword() {
    this.close("cancel_state", { email: this.email });
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;
      self.email = options.email;
      self.renderDialog("forgot_password", {
        email: options.email || "",
        requiredEmail: options.requiredEmail
      });

      self.click("#cancel", cancelResetPassword);

      Module.sc.start.call(self, options);
    },

    submit: resetPassword

    // BEGIN TESTING API
    ,
    resetPassword: resetPassword,
    cancelResetPassword: cancelResetPassword
    // END TESTING API
  });

  return Module;

}());
