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
    if (!actions.called[actionName]) {
       console.error("Actions started: "
          + JSON.stringify(actions.called, null, 2));
    }

    for(var key in requiredOptions) {
      ok(actions.info[actionName], "Expected actions.info to have [" + actionName + "]");
      equal(actions.info[actionName][key], requiredOptions[key],
          actionName + " called with " + key + "=" + requiredOptions[key]);
    }
  }

  function testPasswordUsedForStaging(stagingMessage, stagingAction) {
    mediator.publish(stagingMessage, {
      email: TEST_EMAIL,
      complete: function() {
        testActionStarted("doSetPassword");
        mediator.publish("password_set", {
          complete: function() {
            equal(actions.info[stagingAction].email, TEST_EMAIL,
                      "correct email sent to " + stagingAction);
            start();
          }
        });
      }
    });
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

  function testVerifyStagedAddress(stagedMessage, stagedAction, confirmationMessage, mustAuth) {
    // start with a site name to ensure the site name is passed to the
    // verifyScreenAction.
    mediator.publish("start", { siteName: "Unit Test Site" });
    mediator.publish(stagedMessage, {
      email: TEST_EMAIL
    });

    testActionStarted(stagedAction, {
      email: TEST_EMAIL,
      siteName: "Unit Test Site"
    });

    // At this point the user should be displayed the "go confirm your address"
    // screen.  Simulate the user completing the verification transaction.
    //
    // There are two possibilities here, first, the user must authenticate. If
    // the user must authenticate, send them to the
    // authenticate screen. If the user is already authenticated, call
    // email_valid_and_ready so that an assertion is generated.

    var expectedMessage = mustAuth ? "authenticate" : "email_valid_and_ready";
    mediator.subscribe(expectedMessage, function(msg, info) {
      equal(info.email, TEST_EMAIL, expectedMessage + " triggered with the correct email");
      start();
    });

    // staged_address_confirmed means the user has confirmed their email and the dialog
    // has received the "complete" message from the polling function, and all
    // addresses are synced.  Add the test email and make sure the email_chosen
    // message is triggered.
    storage.addEmail(TEST_EMAIL);
    mediator.publish(confirmationMessage, { mustAuth: mustAuth });
  }

  function createMachine() {
    machine = bid.State.create();
    actions = new ActionsMock();
    machine.start({controller: actions});
  }

  function setContextInfo(auth_level) {
    // Make sure there is context info for network.
    var serverTime = (new Date().getTime()) - 10;
    network.setContext({
      server_time: serverTime,
      domain_key_creation_time: serverTime,
      code_version: "ABCDEF",
      auth_level: auth_level || "password",
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


  // This table defines a way to programatically run through the "stage
  // a secondary address" flows through to the user verifying their ownership
  // of the address.
  //
  // Keys are:
  //   stage: the message that causes a stage action to be started
  //   stageAction: the expected stage action to be called upon stage message.
  //   staged: the message that is triggered when an address is staged.
  //   stagedAction: the action that should be called when an address is
  //                        staged. The user goes to the "check your email"
  //                        screen.
  //   confirmed: the message that is triggered when an address is confirmed.
  //
  var stageAddressTests = [ {
      stage_with_password: "new_user",
      stageAction: "doStageUser",
      staged: "user_staged",
      stagedAction: "doConfirmUser",
      confirmed: "user_confirmed"
    },
    {
      stage_with_password: "stage_email",
      stageAction: "doStageEmail",
      staged: "email_staged",
      stagedAction: "doConfirmEmail",
      confirmed: "email_confirmed"
    },
    {
      stage: "forgot_password",
      stageAction: "doStageResetPassword",
      staged: "reset_password_staged",
      stagedAction: "doConfirmResetPassword",
      confirmed: "reset_password_confirmed"
    },
    {
      stage: "stage_reverify_email",
      stageAction: "doStageReverifyEmail",
      staged: "reverify_email_staged",
      stagedAction: "doConfirmReverifyEmail",
      confirmed: "reverify_email_confirmed"
    },
    {
      stage_with_password: "transition_no_password",
      stageAction: "doStageTransitionToSecondary",
      staged: "transition_to_secondary_staged",
      stagedAction: "doConfirmTransitionToSecondary",
      confirmed: "transition_to_secondary_confirmed"
    }
  ];

  for (var i = 0, stageAddressTest; stageAddressTest = stageAddressTests[i]; ++i) {
      var testName;

      if (stageAddressTest.stage_with_password && stageAddressTest.stageAction) {
        // simulate a staging that requires a password. First, the user goes to
        // the set password screen, the password is subitted, and then the
        // stage action is called.
        testName = "staging process for "
                       + stageAddressTest.stage_with_password
                       + " through password_set - call " + stageAddressTest.stageAction;

        asyncTest(testName,
          testPasswordUsedForStaging.curry(stageAddressTest.stage_with_password,
              stageAddressTest.stageAction));


        // simulate throttling. The user stays at the current screen.
        testName = "simulate throttling for "
                      + stageAddressTest.stage_with_password
                      + " go back to " + stageAddressTest.stageAction;

        asyncTest(testName, testStagingThrottledRetry.curry(
              stageAddressTest.stage_with_password,
              stageAddressTest.stageAction));
      }

      // First test whether stage_XXX messages call the correct action.
      // Only do this test if there is a stage and stageAction defined
      if (stageAddressTest.stage && stageAddressTest.stageAction) {
        testName = stageAddressTest.stage + " - call " + stageAddressTest.stageAction;

        test(testName, function(stageMessage, stageAction) {
          mediator.publish(stageMessage, { email: TEST_EMAIL });
          testActionStarted(stageAction, { email: TEST_EMAIL });
        }.curry(stageAddressTest.stage, stageAddressTest.stageAction));
      }


      // Test the flow from "address staged" which shows the "check your email"
      // screen, simulating a user confirming ownership. The "email_confirmed"
      // message should be triggered.
      testName = stageAddressTest.staged + " to "
                    + stageAddressTest.stagedAction
                    + ", simulate "
                    + stageAddressTest.confirmed
                    + " expects email_confirmed";

      asyncTest(testName, testVerifyStagedAddress.curry(
              stageAddressTest.staged,
              stageAddressTest.stagedAction,
              stageAddressTest.confirmed,
              false));

      // Test the flow from "address staged" which shows the "check your email"
      // screen, simulating a user confirming ownership but must authenticate
      // in the dialog. The "authenticate" message should be
      // triggered.
      testName = stageAddressTest.staged + " to " + stageAddressTest.confirmed +
          " with mustAuth - redirect to authenticate";

      asyncTest(testName, testVerifyStagedAddress.curry(
              stageAddressTest.staged,
              stageAddressTest.stagedAction,
              stageAddressTest.confirmed,
              true));
  }




  test("cancel post new_user password_set flow - go back to the authentication screen", function() {
    mediator.publish("authenticate");
    mediator.publish("new_user", { email: TEST_EMAIL}, { email: TEST_EMAIL });
    mediator.publish("password_set");
    actions.info.doAuthenticate = {};
    mediator.publish("cancel_state");
    equal(actions.info.doAuthenticate.email, TEST_EMAIL, "authenticate called with the correct email");
  });

  test("start - RPInfo always started, issuer set, inline_tosspp not started", function() {
    try {
      mediator.publish("start", {
        termsOfService: "https://browserid.org/TOS.html",
        privacyPolicy: "https://browserid.org/priv.html",
        forceIssuer: "fxos_issuer"
      });
    } catch(e) {
      ok(false, "exception not expected");
    }

    ok(actions.info.doRPInfo.termsOfService, "doRPInfo called with termsOfService set");
    ok(actions.info.doRPInfo.privacyPolicy, "doRPInfo called with privacyPolicy set");

    equal(user.getIssuer(), "fxos_issuer");
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

  asyncTest("primary_user_unauthenticated after user cancelled " +
        "verification of new user - call doAuthenticate", function() {
    mediator.publish("start", {
      email: TEST_EMAIL,
      type: "primary",
      add: false,
      cancelled: true
    });
    mediator.publish("primary_user_unauthenticated", {
      complete: function() {
        ok(actions.called.doAuthenticate, "doAuthenticate called");
        start();
      }
    });
  });

  asyncTest("primary_user_unauthenticated after user cancelled " +
      "verification of additional email to current user - " +
      "call doPickEmail and doAddEmail", function() {
    mediator.publish("start", {
      email: TEST_EMAIL,
      type: "primary",
      add: true,
      cancelled: true
    });
    mediator.publish("primary_user_unauthenticated", {
      complete: function() {
        ok(actions.called.doPickEmail, "doPickEmail called");
        ok(actions.called.doAddEmail, "doAddEmail called");
        start();
      }
    });
  });

  asyncTest("primary_user_unauthenticated, no user cancel - " +
      " - call doPrimaryUserNotProvisioned", function() {
    mediator.publish("start", {
      email: TEST_EMAIL,
      type: "primary",
      cancelled: false
    });
    mediator.publish("primary_user_unauthenticated", {
      complete: function() {
        ok(actions.called.doPrimaryUserNotProvisioned);
        start();
      }
    });
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

  asyncTest("assertion_generated with null assertion - redirect to pick_email", function() {
    mediator.subscribe("kpi_data", function() {
      // kpi_data should not be called with a null assertion.
      ok(false);
    });

    mediator.subscribe("pick_email", function() {
      ok(true, "redirect to pick_email");
      start();
    });
    mediator.publish("assertion_generated", {
      assertion: null
    });
  });

  test("assertion_generated with assertion - doCompleteSignIn called", function() {
    setContextInfo("password");
    storage.addEmail(TEST_EMAIL);

    mediator.subscribe("kpi_data", function(msg, info) {
      // woohoo! an assertion was generated and the dialog is no longer
      // considered orphaned!
      equal(info.orphaned, false);
    });

    mediator.publish("email_chosen", {
      email: TEST_EMAIL
    });
    mediator.publish("assertion_generated", {
      assertion: "assertion"
    });

    testActionStarted("doCompleteSignIn", {
      email: TEST_EMAIL,
      assertion: "assertion"
    });
  });



  asyncTest("email_valid_and_ready, need to ask user whether it's their computer - redirect to is_this_your_computer", function() {
    setContextInfo("password");
    storage.usersComputer.forceAsk(user.userid());
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


  asyncTest("email_chosen with verified secondary email, user must authenticate - call doAuthenticate", function() {
    storage.addEmail(TEST_EMAIL);

    xhr.setContextInfo("auth_level", "assertion");

    mediator.publish("start");
    mediator.publish("email_chosen", {
      email: TEST_EMAIL,
      complete: function() {
        testActionStarted("doAuthenticate", {
          email: TEST_EMAIL,
          email_mutable: false
        });
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

  asyncTest("email_chosen, transition_to_secondary w/o password given - " +
      "this is a user who selected an address in transition from the email picker - " +
      "password needed to stage transition - go to doAuthenticate",
      function () {
    storage.addEmail(TEST_EMAIL);
    xhr.useResult("secondaryTransition");
    mediator.publish("email_chosen", {
      email: TEST_EMAIL,
      complete: function() {
        testActionStarted("doAuthenticate", {
          email: TEST_EMAIL,
          email_mutable: false
        });
        start();
      }
    });
  });

  asyncTest("email_chosen, transition_to_secondary w/ password given - " +
      "this is a user who entered an address in transition from the authentication screen - " +
      "password already known to stage transition - go to doStageTransitionToSecondary",
      function () {
    storage.addEmail(TEST_EMAIL);
    xhr.useResult("secondaryTransition");
    mediator.publish("email_chosen", {
      email: TEST_EMAIL,
      password: "password",
      complete: function() {
        testActionStarted("doStageTransitionToSecondary", {
          email: TEST_EMAIL,
          password: "password"
        });
        start();
      }
    });
  });

  asyncTest("email_chosen with secondary email, transition_no_password", function () {
    storage.addEmail(TEST_EMAIL);
    xhr.useResult("secondaryTransitionPassword");
    mediator.publish("email_chosen", {
      email: TEST_EMAIL,
      complete: function() {
        equal(actions.called.doSetPassword, true, "doSetPassword called");
        mediator.publish("password_set");
        testActionStarted("doStageTransitionToSecondary", {
          email: TEST_EMAIL
        });
        start();
      }
    });
  });

  asyncTest("email_chosen with secondary email that is transitioned to a primary, call doVerifyPrimaryUser", function () {
    storage.addEmail(TEST_EMAIL);
    xhr.useResult("primaryTransition");
    mediator.publish("email_chosen", {
      email: TEST_EMAIL,
      complete: function() {
        ok(actions.called.doVerifyPrimaryUser);
        start();
      }
    });
  });

  function testReverifyEmailChosen(auth_level) {
    storage.addEmail(TEST_EMAIL);
    xhr.setContextInfo("auth_level", auth_level);

    mediator.subscribe("stage_reverify_email", function(msg, info) {
      equal(info.email, TEST_EMAIL, "correctly redirected to stage_reverify_email with correct email");
      start();
    });

    xhr.useResult("unverified");
    mediator.publish("email_chosen", {
      email: TEST_EMAIL
    });
  }

  asyncTest("email_chosen with unverified secondary email, user authenticated to secondary - redirect to stage_reverify_email", function() {
    testReverifyEmailChosen("password");
  });

  asyncTest("email_chosen with unverified secondary email, user authenticated to primary - redirect to stage_reverify_email", function() {
    testReverifyEmailChosen("assertion");
  });

  asyncTest("email_chosen with online primary email - call doProvisionPrimaryUser", function() {
    // If the email is a primary, throw the user down the primary flow.
    // Doing so will catch cases where the primary certificate is expired
    // and the user must re-verify with their IdP. This flow will
    // generate its own assertion when ready.  For efficiency, we could
    // check here whether the cert is ready, but it is early days yet and
    // the format may change.
    storage.addEmail(TEST_EMAIL);
    xhr.useResult("primary");
    mediator.publish("email_chosen", {
      email: TEST_EMAIL,
      complete: function() {
        equal(actions.called.doProvisionPrimaryUser, true,
            "doProvisionPrimaryUser called");
        start();
      }
    });
  });

  asyncTest("email_chosen with offline primary email - transition to primary_offline", function() {
    storage.addEmail(TEST_EMAIL);
    xhr.useResult("primaryOffline");
    mediator.subscribe("primary_offline", function(msg, info) {
      equal(info.email, TEST_EMAIL);
      start();
    });
    mediator.publish("email_chosen", {
      email: TEST_EMAIL
    });
  });

  asyncTest("email_chosen with address in transition_to_primary state - " +
                " call doVerifyPrimaryUser with correct info", function() {

    mediator.publish("start", { siteName: "Unit Test Site" });

    xhr.useResult("primaryTransition");
    mediator.publish("email_chosen", {
      email: TEST_EMAIL,
      allow_new_record: true,
      complete: function() {
        testActionStarted("doVerifyPrimaryUser", {
          email: TEST_EMAIL,
          siteName: "Unit Test Site"
        });
        start();
      }
    });

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
    var hostname = "http://example.com",
        pp = "http://example.com/priv.html",
        tos = "http://example.com/tos.html";

    mediator.publish("start", {
      hostname: hostname,
      privacyPolicy: pp,
      termsOfService: tos
    });
    mediator.publish("assertion_generated", { assertion: null });

    testActionStarted("doPickEmail", {
      origin: hostname,
      termsOfService: tos,
      privacyPolicy: pp
    });
  });

  test("add_email - call doAddEmail", function() {
    mediator.publish("add_email");

    equal(actions.called.doAddEmail, true, "doAddEmail called");
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


  test("pick_email passes along TOS/PP options if no email " +
      "is selected for domain", function() {
    var tos = "https://browserid.org/TOS.html";
    var pp = "https://browserid.org/priv.html";

    mediator.publish("start", {
      termsOfService: tos,
      privacyPolicy: pp
    });

    mediator.publish("pick_email");

    testActionStarted("doPickEmail", {
      termsOfService: tos,
      privacyPolicy: pp
    });
  });

  test("pick_email does not pass along TOS/PP options if email " +
      "is selected for domain", function() {
    var tos = "https://browserid.org/TOS.html";
    var pp = "https://browserid.org/priv.html";

    mediator.publish("start", {
      termsOfService: tos,
      privacyPolicy: pp
    });

    user.setOrigin("browserid.org");
    storage.addEmail("testuser@testuser.com");
    user.setOriginEmail("testuser@testuser.com");

    mediator.publish("pick_email");

    testActionStarted("doPickEmail", {
      termsOfService: false,
      privacyPolicy: false
    });
  });


  asyncTest("new_user KPI for new users", function() {
    mediator.subscribe("kpi_data", function(msg, info) {
      equal(info.new_account, true);
      start();
    });

    // Sequence:
    // 1. user types in unrecognized email address, is shown set password screen
    // 2. user enters password
    //
    // Expect:
    // kpi_data message with new_account: true
    mediator.publish("new_user", { email: TEST_EMAIL });
  });

  asyncTest("new_user KPI for new FirefoxOS users", function() {
    mediator.subscribe("kpi_data", function(msg, info) {
      equal(info.new_account, true);
      start();
    });

    // Sequence:
    // 1. user types in unrecognized email address, is shown set password screen
    // 2. user enters password
    //
    // Expect:
    // kpi_data message with new_account: true
    mediator.publish("new_fxaccount", { email: TEST_EMAIL });
  });

  asyncTest("new_user KPI set to `false` when user hits 'cancel' " +
      "from set_password screen", function() {
    // Sequence:
    // 1. user types in unrecognized email address, is shown set password screen
    // 2. user clicks "cancel" button
    //
    // Expect:
    // kpi_data message with new_account: false
    mediator.publish("new_user", { email: TEST_EMAIL });

    mediator.subscribe("kpi_data", function(msg, info) {
      equal(info.new_account, false);
      start();
    });

    mediator.publish("cancel_state");
  });
}());
