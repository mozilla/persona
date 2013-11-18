/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Models.UserContext = (function() {
  "use strict";
  /**
   * This model represents User Context. It contains basic info
   * about the user.
   */

  var bid = BrowserID,
      und,
      sc;

  var Module = bid.Modules.Module.extend({
    // user context - perhaps this should be somewhere else, like a user model?
    userid: und,
    auth_level: und,
    has_password: und,

    init: function(options) {
      var self = this;

      self.setContext(options);

      sc.init.call(self, options);
    },

    setContext: function(context) {
      this.importFrom(context,
        'userid',
        'auth_level',
        'has_password'
        );
    },

    getUserId: function() {
      return this.userid;
    },

    setUserId: function(userId) {
      this.userid = userId;
    },

    setAuthLevel: function(authLevel) {
      this.auth_level = authLevel;
    },

    getAuthLevel: function() {
      return this.auth_level || false;
    },

    isUserAuthenticated: function() {
      return !!this.auth_level;
    },

    hasPassword: function() {
      return !!this.has_password;
    }
  });

  sc = Module.sc;

  return Module;
}());

