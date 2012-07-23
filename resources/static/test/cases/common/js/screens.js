/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID: true */
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

  test("form", function() {
    el = $("#formWrap .contents");
    screens.form.show("test_template_with_input");

    ok($("#templateInput").length, "the template has been written");
    equal($("body").hasClass("form"), true, "form class added to body");
    equal(screens.form.visible, true, "screen is visible");

    screens.form.hide();
    equal($("body").hasClass("form"), false, "form class removed from body");
    equal(screens.form.visible, false, "screen is not visible");
  });

  test("wait", function() {
    var el = $("#wait .contents");
    screens.wait.show("test_template_with_input");

    ok($("#templateInput").length, "the template has been written");
    equal($("body").hasClass("waiting"), true, "waiting class added to body");
    equal(screens.wait.visible, true, "screen is visible");

    screens.wait.hide();
    equal($("body").hasClass("waiting"), false, "waiting class removed from body");
    equal(screens.wait.visible, false, "screen is not visible");
  });

  test("error", function() {
    var el = $("#error .contents");
    screens.error.show("test_template_with_input");

    ok($("#templateInput").length, "the template has been written");
    equal($("body").hasClass("error"), true, "error class added to body");
    equal(screens.error.visible, true, "screen is visible");

    screens.error.hide();
    equal($("body").hasClass("error"), false, "error class removed from body");
    equal(screens.error.visible, false, "screen is not visible");
  });

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
