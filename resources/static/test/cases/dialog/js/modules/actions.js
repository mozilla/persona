/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      storage = bid.Storage,
      controller,
      el,
      testHelpers = bid.TestHelpers,
      TEST_EMAIL = "testuser@testuser.com";

  function createController(config) {
    controller = BrowserID.Modules.Actions.create();
    controller.start(config);
  }

  function testActionStartsModule(actionName, actionOptions, expectedModule) {
    createController({
      ready: function() {
        var error;
        try {
          controller[actionName](actionOptions);
        } catch(e) {
          error = e;
        }

        equal(error, "module not registered for " + expectedModule, "correct service started");
        start();
      }
    });
  }

  function testStageAddress(actionName, expectedMessage) {
    createController({
      ready: function() {
        var message,
            email;

        testHelpers.register(expectedMessage, function(msg, info) {
          message = msg;
          email = info.email;
        });

        controller[actionName]({ email: TEST_EMAIL, password: "password", ready: function(status) {
          equal(status, true, "correct status");
          equal(message, expectedMessage, "correct message triggered");
          equal(email, TEST_EMAIL, "address successfully staged");
          start();
        }});
      }
    });
  }


  module("dialog/js/modules/actions", {
    setup: function() {
      testHelpers.setup();
    },

    teardown: function() {
      if(controller) {
        controller.destroy();
      }
      testHelpers.teardown();
    }
  });

  asyncTest("doProvisionPrimaryUser - start the provision_primary_user service", function() {
    testActionStartsModule("doProvisionPrimaryUser", {email: TEST_EMAIL},
      "provision_primary_user");
  });

  asyncTest("doVerifyPrimaryUser - start the verify_primary_user service", function() {
    testActionStartsModule("doVerifyPrimaryUser", {},
      "verify_primary_user");
  });

  asyncTest("doCannotVerifyRequiredPrimary - show the error screen", function() {
    createController({
      ready: function() {
        controller.doCannotVerifyRequiredPrimary({ email: TEST_EMAIL});

        testHelpers.testErrorVisible();
        start();
      }
    });

  });

  asyncTest("doPrimaryUserProvisioned - start the primary_user_verified service", function() {
    testActionStartsModule("doPrimaryUserProvisioned", {},
      "primary_user_provisioned");
  });

  asyncTest("doStageUser with successful creation - trigger user_staged", function() {
    testStageAddress("doStageUser", "user_staged");
  });

  asyncTest("doConfirmUser - start the check_registration service", function() {
    testActionStartsModule("doConfirmUser", {email: TEST_EMAIL, siteName: "Unit Test Site"},
      "check_registration");
  });

  asyncTest("doStageEmail with successful staging - trigger email_staged", function() {
    testStageAddress("doStageEmail", "email_staged");
  });

  asyncTest("doConfirmEmail - start the check_registration service", function() {
    testActionStartsModule("doConfirmEmail", {email: TEST_EMAIL, siteName: "Unit Test Site"},
      "check_registration");
  });

  asyncTest("doResetPassword - call the set_password controller with reset_password true", function() {
    testActionStartsModule('doResetPassword', { email: TEST_EMAIL }, "set_password");
  });

  asyncTest("doStageResetPassword - trigger reset_password_staged", function() {
    testStageAddress("doStageResetPassword", "reset_password_staged");
  });

  asyncTest("doConfirmResetPassword - start the check_registration service", function() {
    testActionStartsModule("doConfirmResetPassword", {email: TEST_EMAIL, siteName: "Unit Test Site"},
      "check_registration");
  });

  asyncTest("doStageReverifyEmail - trigger reverify_email_staged", function() {

    storage.addSecondaryEmail(TEST_EMAIL, { verified: false });
    testStageAddress("doStageReverifyEmail", "reverify_email_staged");
  });

  asyncTest("doConfirmReverifyEmail - start the check_registration service", function() {
    testActionStartsModule("doConfirmReverifyEmail", {email: TEST_EMAIL, siteName: "Unit Test Site"},
      "check_registration");
  });

  asyncTest("doGenerateAssertion - start the generate_assertion service", function() {
    testActionStartsModule('doGenerateAssertion', { email: TEST_EMAIL }, "generate_assertion");
  });

  asyncTest("doRPInfo - start the rp_info service", function() {
    createController({
      ready: function() {
        var error;
        try {
          controller.doRPInfo({ name: "browserid.org" });
        } catch(e) {
          error = e;
        }

        equal(error, "module not registered for rp_info", "correct service started");
        start();
      }
    });
  });
}());

