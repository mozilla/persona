/*globals BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.DOMHelpers = (function() {
  "use strict";

  function makeEqualWidth(selector) {
    var els = $(selector),
        maxWidth = 0;

    // Find the widest el then set the width of all the els to be the
    // same.  To do so, first let the els be their natural width, find the
    // widest, and then go from there.
    els.css({
      "min-width": "0px",
      "width": null
    });

    els.each(function(index, element) {
      var width = $(element).outerWidth();
      if (width > maxWidth) maxWidth = width;
    });

    els.css("width", maxWidth + "px");
  }

  return {
    makeEqualWidth: makeEqualWidth
  };

}());
