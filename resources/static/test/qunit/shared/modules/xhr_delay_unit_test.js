/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      Module = bid.Modules.XHRDelay,
      testHelpers = bid.TestHelpers,
      mediator = bid.Mediator,
      screens = bid.Screens,
      mod;

  function createModule(options) {
    mod = Module.create({});
    mod.start(options);
    return mod;
  }

  module("shared/xhr_delay", {
    setup: function() {
      testHelpers.setup();
      createModule();
    },

    teardown: function() {
      testHelpers.teardown();
    }
  });

  test("xhr_delay shows the wait screen, xhr_complete hides the wait screen", function() {
    mediator.publish("xhr_delay");
    ok($("#slowXHR:visible").length, "slowXHR screen is shown");
    testHelpers.testWaitVisible();

    mediator.publish("xhr_complete");
    equal(testHelpers.waitVisible(), false, "slowXHR screen no longer visible");
  });

  test("xhr_complete does not hide wait screen if wait screen not started by xhr_delay", function() {

    screens.wait.show("wait", {title: "test wait", message: "testing"});

    mediator.publish("xhr_complete");
    testHelpers.testWaitVisible();
  });
}());
