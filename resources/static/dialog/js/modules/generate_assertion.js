/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.GenerateAssertion = (function() {
  "use strict";

  var bid = BrowserID,
      dialogHelpers = bid.Helpers.Dialog,
      sc,
      user = bid.User,
      storage = bid.Storage;

  var GenerateAssertion = bid.Modules.PageModule.extend({
    start: function(options) {
      var email = options.email,
          self=this;

      if(!email) {
        throw new Error("email required");
      }

      self.renderLoad("load", {
        title: gettext("signing in")
      });

      dialogHelpers.getAssertion.call(self, email, options.ready);
      sc.start.call(self, options);
    }
  });

  sc = GenerateAssertion.sc;

  return GenerateAssertion;

}());

