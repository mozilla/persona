/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      renderer = bid.Renderer,
      testHelpers = bid.TestHelpers;

  module("common/js/renderer", {
    setup: function() {
      testHelpers.setup();
    },

    teardown: function() {
      testHelpers.teardown();
    }
  });

  test("render template from memory", function() {
    renderer.render("#formWrap .contents", "inMemoryTemplate");

    ok($("#templateInput").length, "template written when loaded from memory");
  });

  test("append template to element", function() {
    renderer.append("#formWrap", "inMemoryTemplate");

    ok($("#formWrap > #templateInput").length && $("#formWrap > .contents"), "template appended to element instead of overwriting it");

  });

  test("render template with partial", function() {
    equal($("#focusButton").length, 0, "template not yet loaded");

    renderer.render("#formWrap .contents", "test_template_with_partial");

    ok($("#focusButton").length, "template loaded with partial");
  });

}());


