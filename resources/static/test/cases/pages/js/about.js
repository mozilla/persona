/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      testHelpers = bid.TestHelpers,
      controller;

  module("pages/js/about", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/about", {});
    },
    teardown: function() {
      testHelpers.teardown();
    }
  });

  function createController(options, callback) {
    controller = BrowserID.about.create();
    controller.start(options);
  }

  test("start - no errors", function() {
    createController({});
    ok(controller, "controller created");
  });

}());
