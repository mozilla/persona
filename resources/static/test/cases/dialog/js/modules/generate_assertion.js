/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      controller,
      testHelpers = bid.TestHelpers,
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

  asyncTest("start with email, expect an assertion to be generated", function() {
    user.syncEmailKeypair("testuser@testuser.com", function() {
      createController({
        email: "testuser@testuser.com",
        delay: 0,
        ready: function(assertion) {
          ok(assertion, "assertion generated");
          testHelpers.testElementExists("#signing_in");

          start();
        }
      });
    });
  });

}());

