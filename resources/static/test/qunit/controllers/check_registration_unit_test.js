/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      xhr = bid.Mocks.xhr,
      network = bid.Network,
      testHelpers = bid.TestHelpers,
      register = testHelpers.register;

  function createController(verifier, message) {
    controller = bid.Modules.CheckRegistration.create();
    controller.start({
      email: "registered@testuser.com",
      verifier: verifier,
      verificationMessage: message
    });
  }

  module("controllers/checkregistration_controller", {
    setup: function() {
      testHelpers.setup();
    },

    teardown: function() {
      testHelpers.teardown();
      if (controller) {
        try {
          // Controller may have already destroyed itself.
          controller.destroy();
        } catch(e) {}
      }
    }
  });

  function testVerifiedUserEvent(event_name, message) {
    createController("waitForUserValidation", event_name);
    register(event_name, function() {
      ok(true, message);
      start();
    });
    controller.startCheck();
  }

  asyncTest("user validation with mustAuth result", function() {
    xhr.useResult("mustAuth");

    testVerifiedUserEvent("authenticate", "User Must Auth");
  });

  asyncTest("user validation with pending->complete result ~3 seconds", function() {
    xhr.useResult("pending");

    testVerifiedUserEvent("user_verified", "User verified");
    // use setTimeout to simulate a delay in the user opening the email.
    setTimeout(function() {
      xhr.useResult("complete");
    }, 500);
  });

  asyncTest("user validation with XHR error", function() {
    xhr.useResult("ajaxError");

    createController("waitForUserValidation", "user_verified");
    controller.startCheck(function() {
      register("user_verified", function() {
        ok(false, "on XHR error, should not complete");
      });
      ok(testHelpers.errorVisible(), "Error message is visible");
      start();
    });
  });

  asyncTest("cancel raises cancel_state", function() {
    createController("waitForUserValidation", "user_verified");
    controller.startCheck(function() {
      register("cancel_state", function() {
        ok(true, "on cancel, cancel_state is triggered");
        start();
      });
      controller.cancel();
    });
  });

}());

