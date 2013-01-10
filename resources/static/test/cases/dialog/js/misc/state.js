/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      mediator = bid.Mediator,
      State = bid.State,
      user = bid.User,
      machine,
      actions,
      network = bid.Network,
      storage = bid.Storage,
      testHelpers = bid.TestHelpers,
      xhr = bid.Mocks.xhr,
      TEST_EMAIL = "testuser@testuser.com";

  var ActionsMock = function() {
    this.called = {};
    this.info = {};
  };
  ActionsMock.prototype = {};
  for(var key in bid.Modules.Actions.prototype) {
    if (bid.Modules.Actions.prototype.hasOwnProperty(key)) {
      ActionsMock.prototype[key] = (function(key) {
        return function(info) {
          this.called[key] = true;
          this.info[key] = info;
        };
      }(key));
      ActionsMock.prototype.reset = function() {
        for(var key in ActionsMock.prototype) {
          if (bid.Modules.Actions.prototype.hasOwnProperty(key)) {
            delete this.called[key];
            delete this.info[key];
          }
        }
      };
    }
  }

  function testActionStarted(actionName, requiredOptions) {
    ok(actions.called[actionName], actionName + " called");
    for(var key in requiredOptions) {
      ok(actions.info[actionName], "Expected actions.info to have [" + actionName + "]");
      equal(actions.info[actionName][key], requiredOptions[key],
          actionName + " called with " + key + "=" + requiredOptions[key]);
    }
  }

  function testStagingThrottledRetry(startMessage, expectedStagingAction) {
    mediator.publish(startMessage, { email: TEST_EMAIL, type: "secondary", complete: function() {
        mediator.publish("password_set");
        actions.reset();

        mediator.publish("password_set");
        testActionStarted(expectedStagingAction, { email: TEST_EMAIL });
        start();
      }
    });
  }

  function testVerifyStagedAddress(startMessage, confirmationMessage, verifyScreenAction) {
    // start with a site name to ensure the site name is passed to the
    // verifyScreenAction.
    mediator.publish("start", { siteName: "Unit Test Site" });
    mediator.publish(startMessage, {
      email: TEST_EMAIL
    });

    testActionStarted(verifyScreenAction, {
      email: TEST_EMAIL,
      siteName: "Unit Test Site"
    });

    // At this point the user should be displayed the "go confirm your address"
    // screen.  Simulate the user completing the verification transaction.

    mediator.subscribe("email_chosen", function(msg, info) {
      equal(info.email, TEST_EMAIL, "email_chosen triggered with the correct email");
      start();
    });

    // staged_address_confirmed means the user has confirmed their email and the dialog
    // has received the "complete" message from the polling function, and all
    // addresses are synced.  Add the test email and make sure the email_chosen
    // message is triggered.
    storage.addEmail(TEST_EMAIL);
    mediator.publish(confirmationMessage);
  }


  function createMachine() {
    machine = bid.State.create();
    actions = new ActionsMock();
    machine.start({controller: actions});
  }

  function setContextInfo(auth_status) {
    // Make sure there is context info for network.
    var serverTime = (new Date().getTime()) - 10;
    mediator.publish("context_info", {
      server_time: serverTime,
      domain_key_creation_time: serverTime,
      code_version: "ABCDEF",
      auth_status: auth_status || "password",
      userid: 1,
      random_seed: "ABCDEFGH"
    });
  }

  module("dialog/js/misc/state", {
    setup: function() {
      testHelpers.setup();
      createMachine();
    },

    teardown: function() {
      testHelpers.teardown();
      machine.stop();
    }
  });


  test("attempt to create a state machine without a controller", function() {
    var error;
    try {
      var badmachine = State.create();
      badmachine.start();
    }
    catch(e) {
      error = e;
    }
    equal(error.message, "start: controller must be specified", "creating a state machine without a controller fails");
  });

  test("cancel post new_user password_set flow - go back to the authentication screen", function() {
    mediator.publish("authenticate");
    mediator.publish("new_user", { email: TEST_EMAIL}, { email: TEST_EMAIL });
    mediator.publish("password_set");
    actions.info.doAuthenticate = {};
    mediator.publish("cancel_state");
    equal(actions.info.doAuthenticate.email, TEST_EMAIL, "authenticate called with the correct email");
  });

  test("password_set for new user - call doStageUser with correct email", function() {
    mediator.publish("new_user", { email: TEST_EMAIL });
    mediator.publish("password_set");

    equal(actions.info.doStageUser.email, TEST_EMAIL, "correct email sent to doStageUser");
  });

  asyncTest("multiple calls to password_set for new_user, simulate throttling - call doStageUser with correct email for each", function() {
    testStagingThrottledRetry("new_user", "doStageUser");
  });

  test("password_set for add secondary email - call doStageEmail with correct email", function() {
    mediator.publish("stage_email", { email: TEST_EMAIL });
    mediator.publish("password_set");

    equal(actions.info.doStageEmail.email, TEST_EMAIL, "correct email sent to doStageEmail");
  });

  test("start - RPInfo always started", function() {
    mediator.publish("start", {
      termsOfService: "https://browserid.org/TOS.html",
      privacyPolicy: "https://browserid.org/priv.html"
    });

    ok(actions.info.doRPInfo.termsOfService, "doRPInfo called with termsOfService set");
    ok(actions.info.doRPInfo.privacyPolicy, "doRPInfo called with privacyPolicy set");
  });

  asyncTest("user_staged to user_confirmed - call doConfirmUser", function() {
    testVerifyStagedAddress("user_staged", "user_confirmed", "doConfirmUser");
  });

  asyncTest("user_confirmed - redirect to email_chosen", function() {
    mediator.subscribe("email_chosen", function(msg, info) {
      equal(info.email, TEST_EMAIL, "correct email passed");
      start();
    });

    // simulate the flow of a user being staged through to confirmation. Since
    // we are not actually doing the middle bits and saving off a cert for the
    // email address, we get an invalid email exception thrown.
    storage.addEmail(TEST_EMAIL);
    mediator.publish("user_staged", { email: TEST_EMAIL });
    try {
      mediator.publish("user_confirmed");
    } catch(e) {
      equal(e.message, "invalid email", "expected failure");
    }
  });

  asyncTest("email_staged to email_confirmed - call doConfirmEmail", function() {
    testVerifyStagedAddress("email_staged", "email_confirmed", "doConfirmEmail");
  });

  asyncTest("primary_user with already provisioned primary user - redirect to primary_user_ready", function() {
    storage.addEmail(TEST_EMAIL, { cert: "cert" });
    mediator.subscribe("primary_user_ready", function(msg, info) {
      equal(info.email, TEST_EMAIL, "primary_user_ready triggered with correct email");
      start();
    });
    mediator.publish("primary_user", { email: TEST_EMAIL });
  });

  asyncTest("primary_user with unprovisioned, unregistered primary user - call doProvisionPrimaryUser", function() {
    mediator.subscribe("kpi_data", function(msg, data) {
      equal(data.new_account, true, "new_account kpi added for new primary user");
      ok(actions.called.doProvisionPrimaryUser, "doPrimaryUserProvisioned called");
      start();
    });
    mediator.publish("primary_user", { email: "unregistered@testuser.com" });
  });

  test("primary_user_provisioned - call doEmailChosen", function() {
    mediator.publish("primary_user_provisioned", { email: TEST_EMAIL });
    ok(actions.called.doPrimaryUserProvisioned, "doPrimaryUserProvisioned called");
  });

  test("primary_user_unauthenticated before verification - call doVerifyPrimaryUser", function() {
    mediator.publish("start");
    mediator.publish("primary_user_unauthenticated");
    ok(actions.called.doVerifyPrimaryUser, "doVerifyPrimaryUser called");
  });

  test("primary_user_unauthenticated after verification of new user - call doAuthenticate", function() {
    mediator.publish("start", { email: TEST_EMAIL, type: "primary", add: false });
    mediator.publish("primary_user_unauthenticated");
    ok(actions.called.doAuthenticate, "doAuthenticate called");
  });

  test("primary_user_unauthenticated after verification of additional email to current user - call doPickEmail and doAddEmail", function() {
    mediator.publish("start", { email: TEST_EMAIL, type: "primary", add: true });
    mediator.publish("primary_user_unauthenticated");
    ok(actions.called.doPickEmail, "doPickEmail called");
    ok(actions.called.doAddEmail, "doAddEmail called");
  });

  test("primary_user_authenticating stops all modules", function() {
    try {
      mediator.publish("primary_user_authenticating");

      equal(machine.success, true, "success flag set");
    } catch(e) {
      // ignore exception, it tries shutting down all the modules.
    }
  });

  test("primary_user - call doProvisionPrimaryUser", function() {
    mediator.publish("primary_user", { email: TEST_EMAIL, assertion: "assertion" });

    ok(actions.called.doProvisionPrimaryUser, "doProvisionPrimaryUser called");
  });

  asyncTest("primary_user_ready - redirect to `email_chosen`", function() {
    storage.addEmail(TEST_EMAIL);
    mediator.subscribe("email_chosen", function(msg, info) {
      equal(info.email, TEST_EMAIL, "correct email passed");
      start();
    });

    mediator.publish("primary_user_ready", { email: TEST_EMAIL, assertion: "assertion" });

  });

  asyncTest("authenticated - redirect to `email_chosen`", function() {
    storage.addEmail(TEST_EMAIL);
    mediator.subscribe("email_chosen", function(msg, data) {
      equal(data.email, TEST_EMAIL);
      start();
    });
    mediator.publish("authenticated", { email: TEST_EMAIL });
  });

  test("forgot_password - call doStageResetPassword with correct options", function() {
    mediator.publish("start", { privacyPolicy: "priv.html", termsOfService: "tos.html" });
    mediator.publish("forgot_password", {
      email: TEST_EMAIL
    });
    testActionStarted("doStageResetPassword", { email: TEST_EMAIL });
  });

  asyncTest("reset_password_staged to reset_password_confirmed - call doConfirmResetPassword then doEmailConfirmed", function() {
    testVerifyStagedAddress("reset_password_staged", "reset_password_confirmed", "doConfirmResetPassword");
  });


  asyncTest("assertion_generated with null assertion - redirect to pick_email", function() {
    mediator.subscribe("pick_email", function() {
      ok(true, "redirect to pick_email");
      start();
    });
    mediator.publish("assertion_generated", {
      assertion: null
    });
  });

  test("assertion_generated with assertion - doAssertionGenerated called", function() {
    setContextInfo("password");
    storage.addEmail(TEST_EMAIL);
    mediator.publish("assertion_generated", {
      assertion: "assertion"
    });

    equal(actions.info.doAssertionGenerated.assertion, "assertion",
        "doAssertionGenerated called with assertion");
  });



  asyncTest("email_valid_and_ready, need to ask user whether it's their computer - redirect to is_this_your_computer", function() {
    setContextInfo("password");
    storage.usersComputer.forceAsk(network.userid());
    mediator.subscribe("is_this_your_computer", function() {
      ok(true, "redirect to is_this_your_computer");
      start();
    });

    mediator.publish("email_valid_and_ready", {
      assertion: "assertion"
    });
  });

  asyncTest("email_valid_and_ready, do not need to ask user whether it's their computer - redirect to generate_assertion", function() {
    setContextInfo("password");
    // First, set up the context info for the email.

    storage.addEmail(TEST_EMAIL);
    mediator.subscribe("generate_assertion", function() {
      ok(true, "redirect to generate_assertion");
      start();
    });
    mediator.publish("email_valid_and_ready", { email: TEST_EMAIL });
  });

  asyncTest("email_confirmed", function() {
    mediator.subscribe("email_chosen", function(msg, info) {
      equal(info.email, TEST_EMAIL, "correct email passed");
      start();
    });
    storage.addEmail(TEST_EMAIL);
    mediator.publish("email_staged", { email: TEST_EMAIL });
    // simulate the flow of a user being staged through to confirmation. Since
    // we are not actually doing the middle bits and saving off a cert for the
    // email address, we get an invalid email exception thrown.
    try {
      mediator.publish("email_confirmed");
    } catch(e) {
      equal(e.message, "invalid email", "expected failure");
    }
  });

  test("cancel_state goes back to previous state if available", function() {
    mediator.publish("pick_email");
    mediator.publish("add_email");

    actions.called.doPickEmail = false;
    mediator.publish("cancel_state");

    ok(actions.called.doPickEmail, "user is picking an email");
  });

  test("notme", function() {
    mediator.publish("notme");

    ok(actions.called.doNotMe, "doNotMe has been called");
  });

  test("authenticate - call doAuthenticate with the correct options", function() {
    mediator.publish("start", { privacyPolicy: "priv.html", termsOfService: "tos.html" });
    mediator.publish("authenticate", { email: TEST_EMAIL });

    testActionStarted("doAuthenticate", { email: TEST_EMAIL, siteTOSPP: true });
  });

  test("start with no special parameters - go straight to checking auth", function() {
    mediator.publish("start");

    equal(actions.called.doCheckAuth, true, "checking auth on start");
  });

  asyncTest("start to complete successful primary email verification - goto 'primary_user'", function() {
    mediator.subscribe("primary_user", function(msg, info) {
      equal(info.email, TEST_EMAIL, "correct email given");
      equal(info.add, true, "correct add flag");
      start();
    });

    mediator.publish("start", { email: TEST_EMAIL, type: "primary", add: true });
  });

  test("cancel", function() {
    mediator.publish("cancel");

    equal(actions.called.doCancel, true, "cancelled everything");
  });


  test("add_email - call doAddEmail with correct options", function() {
    mediator.publish("start", { privacyPolicy: "priv.html", termsOfService: "tos.html" });
    mediator.publish("add_email");
    testActionStarted("doAddEmail");
  });

  asyncTest("email_chosen with verified secondary email, user must authenticate - call doAuthenticateWithRequiredEmail", function() {
    storage.addEmail(TEST_EMAIL);

    xhr.setContextInfo("auth_level", "assertion");

    mediator.publish("start", { privacyPolicy: "priv.html", termsOfService: "tos.html" });
    mediator.publish("email_chosen", {
      email: TEST_EMAIL,
      complete: function() {
        testActionStarted("doAuthenticateWithRequiredEmail", { siteTOSPP: false });
        start();
      }
    });
  });

  asyncTest("email_chosen with verified secondary email, user authenticated to secondary - redirect to email_valid_and_ready", function() {
    storage.addEmail(TEST_EMAIL);
    xhr.setContextInfo("auth_level", "password");

    mediator.subscribe("email_valid_and_ready", function(msg, info) {
      equal(info.email, TEST_EMAIL, "correctly redirected to email_valid_and_ready with correct email");
      start();
    });

    mediator.publish("email_chosen", {
      email: TEST_EMAIL
    });
  });

  test("email_chosen with secondary email, transition_to_secondary", function () {
    storage.addEmail(TEST_EMAIL);
    mediator.publish("email_chosen", {
      email: TEST_EMAIL,
      type: 'secondary',
      state: 'transition_to_secondary'
    });
    equal(actions.called.doAuthenticate, true, "doAuthenticate called");
  });

  test("email_chosen with secondary email, transition_no_password", function () {
    storage.addEmail(TEST_EMAIL);
    mediator.publish("email_chosen", {
      email: TEST_EMAIL,
      type: 'secondary',
      state: 'transition_no_password'
    });
    equal(actions.called.doSetPassword, true, "doSetPassword called");
    mediator.publish("password_set");
    equal(actions.called.doStageTransitionToSecondary, true, "doStageTransitionToSecondary called");
  });

  function testReverifyEmailChosen(auth_level, info) {
    info = info || {};
    storage.addEmail(TEST_EMAIL);
    xhr.setContextInfo("auth_level", auth_level);

    mediator.subscribe("stage_reverify_email", function(msg, info) {
      equal(info.email, TEST_EMAIL, "correctly redirected to stage_reverify_email with correct email");
      start();
    });

    mediator.publish("email_chosen", _.extend(info, {
      email: TEST_EMAIL
    }));
  }

  asyncTest("email_chosen with unverified secondary email, user authenticated to secondary - redirect to stage_reverify_email", function() {
    testReverifyEmailChosen("password", { type: "secondary", state: "unverified" });
  });

  asyncTest("email_chosen with unverified secondary email, user authenticated to primary - redirect to stage_reverify_email", function() {
    testReverifyEmailChosen("assertion", { type: "secondary", state: "unverified" });
  });

  test("email_chosen with primary email - call doProvisionPrimaryUser", function() {
    // If the email is a primary, throw the user down the primary flow.
    // Doing so will catch cases where the primary certificate is expired
    // and the user must re-verify with their IdP. This flow will
    // generate its own assertion when ready.  For efficiency, we could
    // check here whether the cert is ready, but it is early days yet and
    // the format may change.
    var email = TEST_EMAIL;
    storage.addEmail(email);
    mediator.publish("email_chosen", { email: email, type: "primary", issuer: "testuser.com", state: "known" });
    equal(actions.called.doProvisionPrimaryUser, true, "doProvisionPrimaryUser called");
  });

  test("email_chosen with invalid email - throw exception", function() {
    var email = TEST_EMAIL,
        error;

    try {
      mediator.publish("email_chosen", { email: email });
    } catch(e) {
      error = e;
    }

    equal(error.message, "invalid email", "expected exception thrown");
  });

  test("null assertion generated - preserve original options in doPickEmail", function() {
    mediator.publish("start", {
      hostname: "http://example.com",
      privacyPolicy: "http://example.com/priv.html",
      termsOfService: "http://example.com/tos.html"
    });
    mediator.publish("assertion_generated", { assertion: null });

    equal(actions.called.doPickEmail, true, "doPickEmail callled");
    equal(actions.info.doPickEmail.origin, "http://example.com", "hostname preserved");
    equal(actions.info.doPickEmail.siteTOSPP, true, "siteTOSPP preserved");
  });

  test("add_email - call doAddEmail", function() {
    mediator.publish("add_email");

    equal(actions.called.doAddEmail, true, "doAddEmail called");
  });

  asyncTest("stage_email - first secondary email - call doSetPassword", function() {
    xhr.setContextInfo("has_password", false);
    mediator.publish("stage_email", {
      complete: function() {
        testActionStarted("doSetPassword");
        start();
      }
    });
  });


  asyncTest("stage_email - second secondary email - call doStageEmail", function() {
    storage.addEmail("testuser@testuser.com");
    xhr.setContextInfo("has_password", true);

    mediator.publish("stage_email", {
      type: "secondary",
      complete: function() {
        equal(actions.called.doStageEmail, true, "doStageEmail called");
        start();
      }
    });
  });

  asyncTest("multiple calls to password_set for stage_email, simulate throttling - call doStageEmail with correct email for each", function() {
    xhr.setContextInfo("has_password", false);
    testStagingThrottledRetry("stage_email", "doStageEmail");
  });


  test("stage_reverify_email - call doStageReverifyEmail", function() {
    mediator.publish("stage_reverify_email", { email: TEST_EMAIL });
    testActionStarted("doStageReverifyEmail", { email: TEST_EMAIL });
  });

  asyncTest("reverify_email_staged to reverify_email_confirmed - call doConfirmReverifyEmail", function() {
    testVerifyStagedAddress("reverify_email_staged", "reverify_email_confirmed", "doConfirmReverifyEmail");
  });

  asyncTest("window_unload - set the final KPIs", function() {
    mediator.subscribe("kpi_data", function(msg, data) {
      testHelpers.testKeysInObject(data, [
        'number_emails', 'number_sites_signed_in', 'number_sites_remembered', 'orphaned'
      ]);
      start();
    });

    mediator.publish("window_unload");
  });

  function testAuthenticateSpecifiedEmail(specified, expected) {
    var options = {
      email: TEST_EMAIL,
      complete: function() {
        testActionStarted("doAuthenticateWithRequiredEmail", {
          cancelable: expected
        });
        start();
      }
    };

    if (typeof specified !== "undefined") options.cancelable = specified;

    mediator.publish("authenticate_specified_email", options);
  }

  asyncTest("authenticate_specified_email with false specified - call doAuthenticateWithRequiredEmail using specified cancelable", function() {
    testAuthenticateSpecifiedEmail(false, false);
  });

  asyncTest("authenticate_specified_email with true specified - call doAuthenticateWithRequiredEmail using specified cancelable", function() {
    testAuthenticateSpecifiedEmail(true, true);
  });

  asyncTest("authenticate_specified_email without cancelable - call doAuthenticateWithRequiredEmail, cancelable defaults to true", function() {
    testAuthenticateSpecifiedEmail(undefined, true);
  });


}());
