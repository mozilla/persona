/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      controller,
      testHelpers = bid.TestHelpers,
      storage = bid.Storage,
      mediator = bid.Mediator,
      xhr = bid.Mocks.xhr,
      user = bid.User;

  function createController(config) {
    config = config || {};
    controller = bid.Modules.GenerateAssertion.create();
    controller.start(config);
  }

  module("dialog/js/modules/generate_assertion", {
    setup: testHelpers.setup,

    teardown: function() {
      if (controller) {
        controller.destroy();
        controller = null;
      }
      testHelpers.teardown();
    }
  });

  asyncTest("start with valid email - " +
      "expect an assertion to be generated", function() {
    user.syncEmailKeypair("testuser@testuser.com", function() {
      var assertion;
      mediator.subscribe("assertion_generated", function(msg, info) {
        assertion = info.assertion;
      });

      createController({
        email: "testuser@testuser.com",
        ready: function() {
          ok(assertion, "assertion generated");
          start();
        }
      });
    });
  });

  asyncTest("start with error when generating assertion - " +
      "no assertion generated", function() {
    xhr.useResult("ajaxError");
    storage.addEmail("testuser@testuser.com", {});
    mediator.subscribe("assertion_generated", function(msg, info) {
      ok(false);
    });

    createController({
      email: "testuser@testuser.com",
      ready: function() {
        testHelpers.testErrorVisible();
        start();
      }
    });
  });

}());

