/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.EmailChosen = (function() {
  "use strict";

  var bid = BrowserID,
      dialogHelpers = bid.Helpers.Dialog,
      sc,
      user = bid.User,
      storage = bid.Storage;

  var EmailChosen = bid.Modules.PageModule.extend({
    start: function(options) {
      var email = options.email,
          self=this;

      if(!email) {
        throw "email required";
      }

      dialogHelpers.getAssertion.call(self, email, options.ready);
      storage.setLoggedIn(user.getOrigin(), options.email);
      sc.start.call(self, options);
    }
  });

  sc = EmailChosen.sc;

  return EmailChosen;

}());

