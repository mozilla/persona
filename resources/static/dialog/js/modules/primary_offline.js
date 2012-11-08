/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.PrimaryOffline = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      user = bid.User,
      errors = bid.Errors,
      domHelpers = bid.DOMHelpers,
      email;

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};
      var self = this;
      self.renderWait("primary_offline", options);
      Module.sc.start.call(self, options);
    }
  });


  return Module;

}());
