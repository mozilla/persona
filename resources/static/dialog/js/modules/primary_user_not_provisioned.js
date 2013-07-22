/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.PrimaryUserNotProvisioned = (function() {
  "use strict";

  var bid = BrowserID,
      complete = bid.Helpers.complete;

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      var self=this;
      Module.sc.start.call(self, options);

      self.checkRequired(options, "idpName", "email");

      self.renderError("primary_user_not_verified", {
        email: options.email,
        idpName: options.idpName,
        // This is for the KPIs, not the error screen.
        action: {
          title: "Could not verify with primary"
        }
      });

      complete(options.ready);
    }
  });

  return Module;

}());
