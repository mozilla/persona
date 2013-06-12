/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      tooltip = bid.Tooltip,
      testHelpers = bid.TestHelpers,
      testUndefined = testHelpers.testUndefined,
      testTooltipVisible = testHelpers.testTooltipVisible,
      testTooltipNotVisible = testHelpers.testTooltipNotVisible;

  module("common/js/tooltip", {
    setup: function() {
      testHelpers.setup();
    },
    teardown: function() {
      testHelpers.teardown();
    }
  });


  test("show short tooltip - shows for about 2.5 seconds", function() {
    var displayTime = tooltip.showTooltip("#shortTooltip");
    ok(2000 <= displayTime && displayTime <= 3000, displayTime + " - minimum of 2 seconds, max of 3 seconds");
    testTooltipVisible();
  });

  test("show long tooltip - shows for about 5 seconds", function() {
    var displayTime = tooltip.showTooltip("#longTooltip");
    ok(displayTime >= 4500, displayTime + " - longer tooltip is on the screen for a bit longer");
  });

  asyncTest("show tooltip, then reset - hides tooltip, resets shown status", function() {
    tooltip.showTooltip("#shortTooltip");
    setTimeout(function() {
      tooltip.reset();

      equal($(".tooltip:visible").length, 0, "after reset, all tooltips are hidden");
      testTooltipNotVisible();
      start();
    }, 100);
  });

  test("only one tooltip shown at a time", function() {
    tooltip.showTooltip("#shortTooltip");
    tooltip.showTooltip("#shortTooltip");
    equal($(".tooltip:visible").length, 1, "only one tooltip shown at a time");
  });

  test("show a tooltip by specifying the text and the anchor", function() {
    tooltip.showTooltip("some tooltip contents", "#page_head");
    equal($(".tooltip:visible").text().trim(), "some tooltip contents", "correct contents when specified from the command line");
  });

  test("tooltip contents are escaped", function() {
    tooltip.showTooltip("4 < 5", "#page_head");
    equal($(".tooltip:visible .contents").html().trim(), "4 &lt; 5", "tooltip contents are escaped");
  });

  test("no exception thrown if tooltip element does not exist", function() {
    var err;

    try {
      tooltip.showTooltip("#non_existent");
    } catch(e) {
      err = e;
    }

    testUndefined(err, "exception not thrown if tooltip element does not exist");
  });

  test("constrain tooltip to screen", function() {
    tooltip.showTooltip("#longTooltip");
    var visibleTooltip = $(".tooltip:visible");

    var offset = visibleTooltip.offset();
    ok(offset.top > 0);
    ok((offset.left + visibleTooltip.outerWidth())
        < $(window).innerWidth());
  });

}());
