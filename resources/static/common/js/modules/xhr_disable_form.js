/*globals BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.XHRDisableForm = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      sc;

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      self.subscribe("xhr_start",
        dom.addClass.curry("body", "submit_disabled"));
      self.subscribe("xhr_complete",
        dom.removeClass.curry("body", "submit_disabled"));

      sc.start.call(self, options);
    }
  });

  sc = Module.sc;

  return Module;

}());

