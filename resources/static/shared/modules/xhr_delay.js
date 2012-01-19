/*globals BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.XHRDelay = (function() {
  "use strict";

  var bid = BrowserID,
      wait = bid.Wait,
      delayed,
      sc;

  function delayStart() {
    delayed = true;
    // XXX - This has a flaw in it.  If the user is waiting for at the email
    // validation screen and an XHR delay occurs, it will overwrite the waiting
    // for validation screen.  When the xhr delay completes, then it will take
    // away all wait screens and show the add email screen.  Perhaps we need
    // a new screen/layer to avoid this.
    this.renderWait("wait", wait.slowXHR);
  }

  function delayStop() {
    if(delayed) {
      delayed = false;
      this.hideWait();
    }
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      self.subscribe("xhr_delay", delayStart);
      self.subscribe("xhr_complete", delayStop);

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

