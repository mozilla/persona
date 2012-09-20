/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      network = bid.Network,
      testHelpers = bid.TestHelpers,
      register = testHelpers.register;

  function createController(verifier, message, required, password) {
    controller = bid.Modules.CheckRegistration.create();
    controller.start({
      email: "registered@testuser.com",
      password: password,
      verifier: verifier,
      verificationMessage: message,
      required: required,
      siteName: "Unit Test Site"
    });
  }

  module("dialog/js/modules/check_registration", {
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

  function testVerifiedUserEvent(event_name, message, password) {
    createController("waitForUserValidation", event_name, false, password);
    register(event_name, function(msg, info) {
      equal(info.mustAuth, false, "user does not need to verify");
      start();
    });
    controller.startCheck();
  }

  function testMustAuthUserEvent(event_name, message) {
    createController("waitForUserValidation", event_name);
    register(event_name, function(msg, info) {
      equal(info.mustAuth, true, "user needs to verify");
      start();
    });
    controller.startCheck();
  }

  asyncTest("user validation with mustAuth result - userVerified with mustAuth: true", function() {
    xhr.useResult("mustAuth");
    testMustAuthUserEvent("user_verified");
  });

  asyncTest("user validation with pending->complete with auth_level = assertion, no authentication info given - user_verified with mustAuth triggered", function() {
    user.init({ pollDuration: 100 });
    xhr.useResult("pending");
    xhr.setContextInfo("auth_level", "assertion");
    testMustAuthUserEvent("user_verified");

    // use setTimeout to simulate a delay in the user opening the email.
    setTimeout(function() {
      xhr.useResult("complete");
    }, 50);
  });

  asyncTest("user validation with pending->complete with auth_level = password - user_verified triggered", function() {
    user.init({ pollDuration: 100 });
    xhr.useResult("pending");
    xhr.setContextInfo("auth_level", "password");

    testVerifiedUserEvent("user_verified");

    // use setTimeout to simulate a delay in the user opening the email.
    setTimeout(function() {
      xhr.useResult("complete");
    }, 50);
  });

  asyncTest("user validation with XHR error - show error message", function() {
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

  asyncTest("back for normal account creation/email addition - raise cancel_state", function() {
    createController("waitForUserValidation", "user_verified");
    controller.startCheck(function() {
      register("cancel_state", function() {
        ok(true, "cancel_state is triggered");
        start();
      });
      controller.back();
    });
  });

  asyncTest("back for required email - raise cancel", function() {
    createController("waitForUserValidation", "user_verified", true);
    controller.startCheck(function() {
      register("cancel", function() {
        ok(true, "cancel is triggered");
        start();
      });
      controller.back();
    });
  });

}());

