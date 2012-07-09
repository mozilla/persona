/*jshint browser:true, jquery: true, forin: true, laxbreak:true */
/*global BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


BrowserID.Modules.CookieCheck = (function() {
  "use strict";

  var bid = BrowserID,
      complete = bid.Helpers.complete,
      network = bid.Network,
      errors = bid.Errors,
      sc;

  var Module = bid.Modules.PageModule.extend({
      start: function(data) {
        var self=this;

        network.cookiesEnabled(function(status) {
          if(!status) {
            self.renderError("generic", errors.cookiesDisabled);
          }
          complete(data.ready, status);
        }, self.getErrorDialog(errors.cookiesEnabled, data.ready));

        sc.start.call(self, data);
      }
  });

  sc = Module.sc;

  return Module;

}());

