/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      tooltip = bid.Tooltip,
      testHelpers = bid.TestHelpers,
      testUndefined = testHelpers.testUndefined,
      testVisible = testHelpers.testVisible,
      testNotVisible = testHelpers.testNotVisible,
      testTooltipVisible = testHelpers.testTooltipVisible,
      testTooltipNotVisible = testHelpers.testTooltipNotVisible;

  module("common/js/tooltip", {
    setup: testHelpers.setup,
    teardown: testHelpers.teardown
  });


  asyncTest("showTooltip, reset - " +
                  "show tooltip, give associated input box the invalid class",
                  function() {
    tooltip.showTooltip("#shortTooltip", function() {
      testTooltipVisible();
      equal($('#needsTooltip').hasClass("invalid"), true);
      testVisible("#shortTooltip");

      tooltip.reset(function() {
        testNotVisible("#shortTooltip");
        equal($('#needsTooltip').hasClass("invalid"), false);
        testTooltipNotVisible();

        start();
      });
    });
  });

  asyncTest("tooltip hidden whenever user changes input box", function() {
    tooltip.showTooltip("#shortTooltip", function() {
      // synthesize an "enter" key press - no change to input box, tooltip
      // still displayed.
      $("#needsTooltip").trigger("keyup");

      setTimeout(function() {
        equal($('#needsTooltip').hasClass("invalid"), true);
        testVisible("#shortTooltip");

        // synthesize user adds a letter - hides the tooltip
        $("#needsTooltip").val("a");
        $("#needsTooltip").trigger("keyup");

        setTimeout(function() {
          testNotVisible("#shortTooltip");
          equal($('#needsTooltip').hasClass("invalid"), false);
          testTooltipNotVisible();

          start();
        }, 10);
      }, 10);
    });
  });

  asyncTest("only one tooltip shown at a time", function() {
    tooltip.showTooltip("#shortTooltip", function() {
      tooltip.showTooltip("#secondTooltip", function() {
        testNotVisible("#shortTooltip");
        testVisible("#secondTooltip");
        equal($('#needsTooltip').hasClass("invalid"), true);

        testTooltipVisible();

        start();
      });
    });
  });

  test("no exception thrown if tooltip element does not exist", function() {
    var err;

    try {
      tooltip.showTooltip("#non_existent");
    } catch(e) {
      err = e;
    }

    testUndefined(err);
  });
}());
