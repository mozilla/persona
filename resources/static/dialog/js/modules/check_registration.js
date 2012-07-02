/*jshint browser:true, jquery: true, forin: true, laxbreak:true */
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
      self.password = options.password;

      self.click("#back", self.back);

      Module.sc.start.call(self, options);
    },

    startCheck: function(oncomplete) {
      var self=this;
      user[self.verifier](self.email, function(status) {
        if (status === "complete") {
          // TODO - move the syncEmails somewhere else, perhaps into user.js
          user.syncEmails(function() {
            self.close(self.verificationMessage);
            oncomplete && oncomplete();
          });
        }
        else if (status === "mustAuth") {
          // if we have a password (because it was just chosen in dialog),
          // then we can authenticate the user and proceed
          if (self.password) {
            user.authenticate(self.email, self.password, function (authenticated) {
              if (authenticated) {
                user.syncEmails(function() {
                  self.close(self.verificationMessage);
                  oncomplete && oncomplete();
                });
              } else {
                user.addressInfo(self.email, function(info) {
                  self.close("authenticate", info);
                });
              }
            });
          } else {
            user.addressInfo(self.email, function(info) {
              self.close("authenticate", info);
            });
          }

          oncomplete && oncomplete();
        }
      }, self.getErrorDialog(errors.registration, oncomplete));
    },

    back: function() {
      user.cancelUserValidation();
      this.publish(this.required ? "cancel" : "cancel_state");
    }
  });

  return Module;

}());
