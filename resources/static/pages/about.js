/*globals BrowserID:true, $:true*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.about = (function() {
  "use strict";

  var bid = BrowserID;

  function resize() {
    // Get tallest blurb
    var tallestBlurb = 0

    $('.half').each(function(index) {
      var $this = $(this);

      if (index == 0) {
        tallestBlurb = $this.height();
      } else {

        if ($this.height() < tallestBlurb) {
          $this.css('min-height', tallestBlurb);
        } else {
          $('.half.first').css('min-height', $this.height());
        }

      }
    });
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      Module.sc.start.call(self, options);
      resize();

      // The half heights can change every time there is a window resize.
      self.bind(window, "resize", resize);
    }
  });

  return Module;
}());
