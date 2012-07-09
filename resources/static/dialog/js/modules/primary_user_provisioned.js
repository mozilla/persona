/*jshint browser:true, jquery: true, forin: true, laxbreak:true */
/*global BrowserID:true, PageController: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.PrimaryUserProvisioned = (function() {
  "use strict";

  var ANIMATION_TIME = 250,
      bid = BrowserID,
      user = bid.User,
      network = bid.Network,
      errors = bid.Errors;

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      var self = this,
          email = options.email,
          assertion = options.assertion,
          addEmailToCurrentUser = !!options.add,
          complete = function(status) {
            options.ready && options.ready(status || false);
          },
          delay = options.complete_delay || 3000;

      self.checkRequired(options, "email", "assertion");

      self.renderDialog("primary_user_verified", { email: email });

      if(addEmailToCurrentUser) {
        network.addEmailWithAssertion(assertion, function(status) {
          if(status) {
            setTimeout(function() {
              self.publish("primary_user_ready", options);
            }, delay);
          }
          else {
            self.getErrorDialog(errors.addEmailWithAssertion, complete)();
          }
        }, self.getErrorDialog(errors.addEmailWithAssertion, complete));
      }
      else {
        user.authenticateWithAssertion(email, assertion, function(status) {
          if(status) {
            setTimeout(function() {
              self.publish("primary_user_ready", options);
            }, delay);
          }
          else {
            self.getErrorDialog(errors.authenticateWithAssertion, complete)();
          }
        }, self.getErrorDialog(errors.authenticateWithAssertion, complete));
      }

      Module.sc.start.call(self, options);
    }

    // BEGIN TESTING API

    // END TESTING API
  });

  return Module;

}());
