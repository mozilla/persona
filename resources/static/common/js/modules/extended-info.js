/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Modules.ExtendedInfo = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      complete = bid.Helpers.complete;


  var Module = bid.Modules.PageModule.extend({
    start: function(config) {
      var self=this;

      self.checkRequired(config, "target");
      self.target = config.target;

      var openerEl = self.openerEl = $(".openMoreInfo", self.target);
      self.click(openerEl, self.open);

      Module.sc.start.call(self, config);
    },

    open: function(oncomplete) {
      var self = this,
          extendedInfoEl = $(".moreInfo", self.target);

      /**
       * XXX What a big steaming pile, use CSS animations for this!
       */
      $(extendedInfoEl).slideDown(function() {
        // The expanded info may be partially obscured on mobile devices in
        // landscape mode.  Force the screen size hacks to account for the new
        // expanded size.
        dom.fireEvent(window, "resize");
        complete(oncomplete);
      });
      $(self.openerEl).css({visibility: "hidden"});
    }
  });

  return Module;
}());

