/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID:true, PageController: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.IsThisYourComputer = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      network = bid.Network,
      storage = bid.Storage,
      errors = bid.Errors,
      email;

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};
      email = options.email;

      var self = this;

      self.renderWait("is_this_your_computer", options);

      // TODO - Make the selectors use ids instead of classes.
      self.click("button.this_is_my_computer", self.yes);
      self.click("button.this_is_not_my_computer", self.no);

      Module.sc.start.call(self, options);
    },

    yes: function() {
      // TODO - Move this to user.js where it could be used by other clients in
      // other areas.
      storage.usersComputer.setConfirmed(network.userid());
      this.confirmed(true);
    },

    no: function() {
      storage.usersComputer.setDenied(network.userid());
      this.confirmed(false);
    },

    confirmed: function(status) {
      this.publish("user_computer_status_set", { users_computer: status });
    }

  });


  return Module;

}());
