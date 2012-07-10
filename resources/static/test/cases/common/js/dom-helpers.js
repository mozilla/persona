/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      testHelpers = bid.TestHelpers,
      domHelpers = bid.DOMHelpers;

  module("common/js/dom-helpers", {
    setup: testHelpers.setup,
    teardown: testHelpers.teardown
  });

  test("makeEqualWidth", function() {
    bid.Renderer.render("#page_head", "is_this_your_computer", {});

    domHelpers.makeEqualWidth("#your_computer_content button");

    var lastWidth;
    $("#your_computer_content button").each(function(index, element) {
      var currWidth = $(element).outerWidth();
      if (lastWidth) {
        equal(currWidth, lastWidth, "button widths are the same");
      }
      lastWidth = currWidth;
    });
  });

}());
