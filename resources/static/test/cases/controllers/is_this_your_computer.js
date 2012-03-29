/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      el = $("body"),
      bid = BrowserID,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      modules = bid.Modules,
      testHelpers = bid.TestHelpers,
      register = testHelpers.register;


  module("controllers/is_this_your_computer", {
    setup: function() {
      testHelpers.setup();
    },

    teardown: function() {
      if (controller) {
        try {
          controller.destroy();
          controller = null;
        } catch(e) {
          // could already be destroyed from the close
        }
      }
      testHelpers.teardown();
    }
  });

  function createController(options) {
    controller = modules.IsThisYourComputer.create();
    controller.start(options || {});
  }

  test("yes - sets ownership flag to true for the user", function() {
    console.log("add a test");
  });

  test("no - set the ownership flag to false for the user", function() {
    console.log("add a test");
  });
}());

