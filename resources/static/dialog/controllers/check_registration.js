/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID: true, PageController: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.CheckRegistration = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      dom = bid.DOM,
      errors = bid.Errors;

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;
      options = options || {};
      options.required = !!options.required;

      self.renderWait("confirm_email", options);
      self.email = options.email;
      self.verifier = options.verifier;
      self.verificationMessage = options.verificationMessage;

      self.click("#back", self.back);
      self.click("#cancel", self.cancel);

      Module.sc.start.call(self, options);
    },

    startCheck: function(oncomplete) {
      var self=this;
      user[self.verifier](self.email, function(status) {
        if (status === "complete") {
          user.syncEmails(function() {
            self.close(self.verificationMessage);
            oncomplete && oncomplete();
          });
        }
        else if (status === "mustAuth") {
          self.close("authenticate", { email: self.email });
          oncomplete && oncomplete();
        }
      }, self.getErrorDialog(errors.registration, oncomplete));
    },

    back: function() {
      // XXX this should change to cancelEmailValidation for email, but this
      // will work.
      user.cancelUserValidation();
      this.close("cancel_state");
    },

    cancel: function() {
      this.close("cancel");
    }

  });

  return Module;

}());
