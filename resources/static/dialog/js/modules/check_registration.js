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

      self.checkRequired(options, "email", "siteName");
      var templateData = {
        email: options.email,
        required: options.required,
        siteName: options.siteName
      };
      self.renderWait("confirm_email", templateData);

      self.email = options.email;
      self.verifier = options.verifier;
      self.verificationMessage = options.verificationMessage;
      self.required = options.required;

      self.click("#back", self.back);

      Module.sc.start.call(self, options);
    },

    startCheck: function(oncomplete) {
      var self=this;
      user[self.verifier](self.email, function(status) {
        self.close(self.verificationMessage, { mustAuth: status === "mustAuth" });

        oncomplete && oncomplete();
      }, self.getErrorDialog(errors.registration, oncomplete));
    },

    back: function() {
      user.cancelUserValidation();
      this.publish(this.required ? "cancel" : "cancel_state");
    }
  });

  return Module;

}());
