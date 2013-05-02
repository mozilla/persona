/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      screens = bid.Screens,
      testHelpers = bid.TestHelpers,
      el;

  module("common/js/screens", {
    setup: function() {
      testHelpers.setup();
    },

    teardown: function() {
      testHelpers.teardown();
    }
  });

  function testScreen(screenName, bodyClass) {
    screens[screenName].show("test_template_with_input");

    ok($("#templateInput").length, "the template has been written");
    equal($("body").hasClass(bodyClass), true, bodyClass + " class added to body");
    equal(screens[screenName].visible, true, "screen is visible");

    screens[screenName].hide();
    equal($("body").hasClass(bodyClass), false, bodyClass + " class removed from body");
    equal(screens[screenName].visible, false, "screen is not visible");
  }


  var SCREENS = {
    form: "form",
    load: "loading",
    wait: "waiting",
    delay: "delay",
    error: "error"
  };

  for (var screenName in SCREENS) {
    test(screenName, testScreen.curry(screenName, SCREENS[screenName]));
  }

  test("XHR 503 (server unavailable) error", function() {
    var el = $("#error .contents");

    screens.error.show("error", {
      network: {
        status: 503
      }
    });

    ok($("#error_503").length, "503 header is shown");
  });

  test("XHR 403 (Forbidden) error - show the 403, cookies required error", function() {
    var el = $("#error .contents");

    screens.error.show("error", {
      network: {
        status: 403
      }
    });

    ok($("#error_403").length, "403 header is shown");
  });
}());
