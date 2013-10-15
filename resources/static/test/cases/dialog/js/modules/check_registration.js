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
      screens = bid.Screens,
      testHelpers = bid.TestHelpers,
      register = testHelpers.register;

  function createController(verifier, message ) {
    controller = bid.Modules.CheckRegistration.create();
    var rpInfo = bid.Models.RpInfo.create({
      origin: "http://testuser.com",
      siteName: "Unit Test Site"
    });

    controller.start({
      email: "registered@testuser.com",
      verifier: verifier,
      verificationMessage: message,
      rpInfo: rpInfo
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

  function testVerifiedUserEvent(event_name, message) {
    createController("waitForUserValidation", event_name, false);
    register(event_name, function(msg, info) {
      equal(info.mustAuth, false, "user does not need to verify");
      testHelpers.testAddressesSyncedAfterUserRegistration();
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

  /**
   * The loading screen could be shown when the check registration screen is
   * shown. If it is, make sure that it is hidden before showing this screen or
   * else the user never sees the "check your email" message.
   */
  test("all other warning screens hidden on startup", function() {
    xhr.useResult("mustAuth");

    screens.load.show("load", { title: "test screen" });
    ok(screens.load.visible);
    createController("loadForUserValidation", "user_verified");
    equal(screens.load.visible, false);
  });

  asyncTest("user validation with mustAuth result - userVerified with mustAuth: true", function() {
    xhr.useResult("mustAuth");
    testMustAuthUserEvent("user_verified");
  });

  asyncTest("user validation with pending->complete with auth_level = assertion - user_verified with mustAuth triggered", function() {
    user.init({ pollDuration: 100 });
    xhr.useResult("pending");
    xhr.setContextInfo("auth_level", "assertion");
    xhr.setContextInfo("userid", 1);
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
    xhr.setContextInfo("userid", 1);

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

  asyncTest("back for account creation/email addition - raise cancel_state", function() {
    createController("waitForUserValidation", "user_verified");
    controller.startCheck(function() {
      register("cancel_state", function() {
        ok(true, "cancel_state is triggered");
        start();
      });
      controller.back();
    });
  });

  test("if no siteName is specified in rpInfo, use the hostname", function() {
    controller = bid.Modules.CheckRegistration.create();
    var rpInfo = bid.Models.RpInfo.create({
      origin: "http://testrp.com"
    });

    controller.start({
      email: "registered@testuser.com",
      verifier: "waitForUserValidation",
      verificationMessage: "user_verified",
      rpInfo: rpInfo
    });

    notEqual($(".js-check-registration--site-name").html().indexOf("testrp.com"), -1);

  });

}());

