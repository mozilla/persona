/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.PrimaryOffline = (function() {
  "use strict";

  var bid = BrowserID,
      helpers = bid.Helpers,
      user = bid.User;

  function startDialogOver() {
    /*jshint validthis:true*/
    // Reset the caches so that a user who cancels from this screen can go back
    // and try the same address again in a few minutes.
    user.resetCaches();
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
    },

    // BEGIN TESTING API
    cancel: startDialogOver
    // END TESTING API
  });

  return Module;
}());
