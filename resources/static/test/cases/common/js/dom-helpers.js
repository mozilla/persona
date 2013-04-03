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

    // Ensure old width is removed before calculating the natural width of the
    // element. Check by setting the width of one of the elements manually and
    // then see if it is removed later. See issue #2066
    $("#your_computer_content button").eq(0).css({"width": "4000px"});

    domHelpers.makeEqualWidth("#your_computer_content button");

    var lastWidth;
    $("#your_computer_content button").each(function(index, element) {
      var currWidth = $(element).outerWidth();

      // make sure the impossibly large width was removed.
      ok(parseInt(currWidth, 10) !== 4000);

      if (lastWidth) {
        equal(currWidth, lastWidth, "button widths are the same");
      }
      lastWidth = currWidth;
    });
  });

}());
