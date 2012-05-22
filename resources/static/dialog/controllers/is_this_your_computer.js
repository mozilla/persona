/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID:true, PageController: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.IsThisYourComputer = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      user = bid.User,
      errors = bid.Errors,
      email;

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};
      email = options.email;

      var self = this;

      self.renderWait("is_this_your_computer", options);

      // renderWait does not automatically focus the first input element or
      // button, so it must be done manually.
      dom.focus("#this_is_my_computer");

      self.click("#this_is_my_computer", self.yes);
      self.click("#this_is_not_my_computer", self.no);

      Module.sc.start.call(self, options);
    },

    yes: function() {
      this.confirmed(true);
    },

    no: function() {
      this.confirmed(false);
    },

    confirmed: function(status) {
      var self=this;
      user.setComputerOwnershipStatus(status, function() {
        self.close("user_computer_status_set", { users_computer: status });
      }, self.getErrorDialog(errors.setComputerOwnershipStatus));
    }
  });


  return Module;

}());
