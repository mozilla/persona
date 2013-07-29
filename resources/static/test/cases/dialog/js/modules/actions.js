/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      storage = bid.Storage,
      mediator = bid.Mediator,
      xhr = bid.Mocks.xhr,
      controller,
      el,
      testHelpers = bid.TestHelpers,
      TEST_EMAIL = "testuser@testuser.com";

  function createController(config) {
    controller = BrowserID.Modules.Actions.create();
    controller.start(config);
  }

  function testActionStartsModule(actionName, actionOptions, expectedModule, expectedServiceName) {
    createController({
      ready: function() {
        var error,
            reportedServiceName;

        // Check that KPI service reporting is acting as expected.
        mediator.subscribe("service", function(msg, data) {
          reportedServiceName = data.name;
        });

        try {
          controller[actionName](actionOptions);
        } catch(e) {
          error = e;
        }

        equal(error.message, "module not registered for " + expectedModule, "correct module started");
        equal(reportedServiceName, expectedServiceName || expectedModule, "correct service name");
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
          equal(status.success, true, "correct status");
          equal(message, expectedMessage, "correct message triggered");
          equal(email, TEST_EMAIL, "address successfully staged");
          start();
        }});
      }
    });
  }

  function testDoCheckAuth(forceAuthentication, authLevel, userId,
      expectedAuthLevel) {
    createController({
      ready: function() {
        mediator.subscribe("authentication_checked", function(msg, info) {
          equal(info.authenticated, expectedAuthLevel);
          start();
        });
        if (authLevel && userId) {
          xhr.setContextInfo("auth_level", authLevel);
          xhr.setContextInfo("userid", userId);
        }
        controller.doCheckAuth({ forceAuthentication: forceAuthentication });
      }
    });
  }

  module("dialog/js/modules/actions", {
    setup: function() {
      testHelpers.setup();
    },

    teardown: function() {
      if (controller) {
        controller.destroy();
        controller = null;
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

  asyncTest("doStageResetPassword - trigger reset_password_staged", function() {
    testStageAddress("doStageResetPassword", "reset_password_staged");
  });

  asyncTest("doConfirmResetPassword - start the check_registration service", function() {
    testActionStartsModule("doConfirmResetPassword", {email: TEST_EMAIL, siteName: "Unit Test Site"},
      "check_registration");
  });

  asyncTest("doStageReverifyEmail - trigger reverify_email_staged", function() {
    storage.addEmail(TEST_EMAIL);
    testStageAddress("doStageReverifyEmail", "reverify_email_staged");
  });

  asyncTest("doConfirmReverifyEmail - start the check_registration service", function() {
    testActionStartsModule("doConfirmReverifyEmail", {email: TEST_EMAIL, siteName: "Unit Test Site"},
      "check_registration");
  });

  asyncTest("doStageTransitionToSecondary - "
                + "trigger transition_to_secondary_staged", function() {
    testStageAddress("doStageTransitionToSecondary",
        "transition_to_secondary_staged");
  });

  asyncTest("doConfirmTransitionToSecondary - "
                + "start the check_registration service", function() {
    testActionStartsModule("doConfirmTransitionToSecondary",
        { email: TEST_EMAIL }, "check_registration");
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

        equal(error.message, "module not registered for rp_info", "correct service started");
        start();
      }
    });
  });

  asyncTest("doCheckAuth of authenticated user without forceAuthentication",
      function() {
    testDoCheckAuth(false, "password", 1, "password");
  });

  asyncTest("doCheckAuth of authenticated user with forceAuthentication",
      function() {
    testDoCheckAuth(true, "password", 1, false);
  });

  asyncTest("doCheckAuth of unauthenticated user", function() {
    testDoCheckAuth(true, undefined, undefined, false);
  });

  asyncTest("doCompleteSignIn starts complete_sign_in service", function() {
    testActionStartsModule('doCompleteSignIn', { email: TEST_EMAIL },
      "complete_sign_in");
  });

}());

