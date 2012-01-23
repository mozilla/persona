/*globals BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.XHRDelay = (function() {
  "use strict";

  var bid = BrowserID,
      wait = bid.Wait,
      sc;

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      //self.subscribe("xhr_delay", this.renderWait.curry("wait", wait.slowXHR));
      //self.subscribe("xhr_complete", this.hideWait);

      sc.start.call(self, options);
    },

    stop: function() {
      this.hideWait();
      sc.stop.call(this);
    }
  });

  sc = Module.sc;

  return Module;

}());

