/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      controller,
      testHelpers = bid.TestHelpers;

  function createController(config) {
    controller = BrowserID.Modules.CompleteSignIn.create();
    controller.start(config);
  }

  module("dialog/js/modules/complete_sign_in", {
    setup: testHelpers.setup,
    teardown: function() {
      if (controller) {
        controller.destroy();
        controller = null;
      }
      testHelpers.teardown();
    }
  });


  asyncTest("start - shows the complete_sign_in template", function() {
    createController({
      email: "testuser@testuser.com",
      ready: function() {
        testHelpers.testElementExists("#complete_sign_in");
        start();
      }
    });
  });

}());

