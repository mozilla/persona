/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
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

  module("controllers/actions", {
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

  asyncTest("doError with no template - display default error screen", function() {
    createController({
      ready: function() {
        equal(testHelpers.errorVisible(), false, "Error is not yet visible");
        controller.doError({});
        ok(testHelpers.errorVisible(), "Error is visible");
        equal($("#defaultError").length, 1, "default error screen is shown");
        start();
      }
    });
  });

  asyncTest("doError with with template - display error screen", function() {
    createController({
      ready: function() {
        equal(testHelpers.errorVisible(), false, "Error is not yet visible");
        controller.doError("invalid_required_email", {email: "email"});
        equal($("#invalidRequiredEmail").length, 1, "default error screen is shown");
        ok(testHelpers.errorVisible(), "Error is visible");
        start();
      }
    });
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
        controller.doCannotVerifyRequiredPrimary({ email: "testuser@testuser.com"});

        testHelpers.testErrorVisible();
        start();
      }
    });

  });

  asyncTest("doPrimaryUserProvisioned - start the primary_user_verified service", function() {
    testActionStartsModule("doPrimaryUserProvisioned", {},
      "primary_user_provisioned");
  });

  asyncTest("doConfirmUser - start the check_registration service", function() {
    testActionStartsModule("doConfirmUser", {email: TEST_EMAIL},
      "check_registration");
  });

  asyncTest("doConfirmEmail - start the check_registration service", function() {
    testActionStartsModule("doConfirmEmail", {email: TEST_EMAIL},
      "check_registration");
  });

  asyncTest("doGenerateAssertion - start the generate_assertion service", function() {
    testActionStartsModule('doGenerateAssertion', { email: TEST_EMAIL }, "generate_assertion");
  });

}());

