/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.PrimaryOffline = (function() {
  "use strict";

  var bid = BrowserID,
      helpers = bid.Helpers;

  function startDialogOver() {
    /*jshint validthis:true*/
    this.close("cancel_state");
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};
      var self = this;

      self.checkRequired(options, "email");

      options.idpName = helpers.getDomainFromEmail(options.email);
      self.renderError("primary_offline", options);
      self.click("#primary_offline_confirm", startDialogOver);
      Module.sc.start.call(self, options);
    }
  });

  return Module;
}());
