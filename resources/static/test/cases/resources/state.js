/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
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
    if(bid.Modules.Actions.prototype.hasOwnProperty(key)) {
      ActionsMock.prototype[key] = (function(key) {
        return function(info) {
          this.called[key] = true;
          this.info[key] = info;
        };
      }(key));
    }
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

  module("resources/state", {
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
    equal(error, "start: controller must be specified", "creating a state machine without a controller fails");
  });

  test("new_user - call doSetPassword with correct email, cancelable set to true", function() {
    mediator.publish("new_user", { email: TEST_EMAIL });

    testHelpers.testObjectValuesEqual(actions.info.doSetPassword, {
      email: TEST_EMAIL,
      cancelable: true
    });
  });

  test("new_user with requiredEmail - call doSetPassword with correct email, cancelable set to false", function() {
    mediator.publish("start", { requiredEmail: TEST_EMAIL });
    mediator.publish("new_user", { email: TEST_EMAIL });

    testHelpers.testObjectValuesEqual(actions.info.doSetPassword, {
      email: TEST_EMAIL,
      cancelable: false
    });
  });

  test("cancel new user password_set flow - go back to the authentication screen", function() {
    mediator.publish("authenticate");
    mediator.publish("new_user", undefined, { email: TEST_EMAIL });
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

  test("password_set for add secondary email - call doStageEmail with correct email", function() {
    mediator.publish("stage_email", { email: TEST_EMAIL });
    mediator.publish("password_set");

    equal(actions.info.doStageEmail.email, TEST_EMAIL, "correct email sent to doStageEmail");
  });

  test("password_set for reset password - call doResetPassword with correct email", function() {
    mediator.publish("forgot_password", { email: TEST_EMAIL });
    mediator.publish("password_set");

    equal(actions.info.doResetPassword.email, TEST_EMAIL, "correct email sent to doResetPassword");
  });

  test("user_staged - call doConfirmUser", function() {
    mediator.publish("user_staged", { email: TEST_EMAIL });

    equal(actions.info.doConfirmUser.email, TEST_EMAIL, "waiting for email confirmation for testuser@testuser.com");
  });

  test("user_staged with required email - call doConfirmUser with required = true", function() {
    mediator.publish("start", { requiredEmail: TEST_EMAIL });
    mediator.publish("user_staged", { email: TEST_EMAIL });

    equal(actions.info.doConfirmUser.required, true, "doConfirmUser called with required flag");
  });

  test("user_confirmed - redirect to email_chosen", function() {
    mediator.subscribe("email_chosen", function(msg, info) {
      equal(info.email, TEST_EMAIL, "correct email passed");
      start();
    });

    // simulate the flow of a user being staged through to confirmation. Since
    // we are not actually doing the middle bits and saving off a cert for the
    // email address, we get an invalid email exception thrown.
    mediator.publish("user_staged", { email: TEST_EMAIL });
    try {
      mediator.publish("user_confirmed");
    } catch(e) {
      equal(e.toString(), "invalid email", "expected failure");
    }
  });

  test("email_staged - call doConfirmEmail", function() {
    mediator.publish("email_staged", { email: TEST_EMAIL });

    equal(actions.info.doConfirmEmail.required, false, "doConfirmEmail called without required flag");
  });

  test("email_staged with required email - call doConfirmEmail with required = true", function() {
    mediator.publish("start", { requiredEmail: TEST_EMAIL });
    mediator.publish("email_staged", { email: TEST_EMAIL });

    equal(actions.info.doConfirmEmail.required, true, "doConfirmEmail called with required flag");
  });

  asyncTest("primary_user with already provisioned primary user - redirect to primary_user_ready", function() {
    storage.addEmail(TEST_EMAIL, { type: "primary", cert: "cert" });
    mediator.subscribe("primary_user_ready", function(msg, info) {
      equal(info.email, TEST_EMAIL, "primary_user_ready triggered with correct email");
      start();
    });
    mediator.publish("primary_user", { email: TEST_EMAIL });
  });

  test("primary_user with unprovisioned primary user - call doProvisionPrimaryUser", function() {
    mediator.publish("primary_user", { email: TEST_EMAIL });
    ok(actions.called.doProvisionPrimaryUser, "doPrimaryUserProvisioned called");
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

  test("primary_user_unauthenticated after required email - call doCannotVerifyRequiredPrimary", function() {
    mediator.publish("start", { requiredEmail: TEST_EMAIL, type: "primary", add: false, email: TEST_EMAIL });
    mediator.publish("primary_user_unauthenticated");
    ok(actions.called.doCannotVerifyRequiredPrimary, "doCannotVerifyRequiredPrimary called");
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
    storage.addEmail(TEST_EMAIL, {});
    mediator.subscribe("email_chosen", function(msg, info) {
      equal(info.email, TEST_EMAIL, "correct email passed");
      start();
    });

    mediator.publish("primary_user_ready", { email: TEST_EMAIL, assertion: "assertion" });

  });

  asyncTest("authenticated - redirect to `email_chosen`", function() {
    storage.addEmail(TEST_EMAIL, {});
    mediator.subscribe("email_chosen", function(msg, data) {
      equal(data.email, TEST_EMAIL);
      start();
    });
    mediator.publish("authenticated", { email: TEST_EMAIL });
  });

  test("forgot_password", function() {
    mediator.publish("forgot_password", {
      email: TEST_EMAIL,
      requiredEmail: true
    });
    equal(actions.info.doForgotPassword.email, TEST_EMAIL, "correct email passed");
    equal(actions.info.doForgotPassword.requiredEmail, true, "correct requiredEmail passed");
  });

  test("password_reset to user_confirmed - call doUserStaged then doEmailConfirmed", function() {
    // password_reset indicates the user has verified that they want to reset
    // their password.
    mediator.publish("password_reset", {
      email: TEST_EMAIL
    });
    equal(actions.info.doConfirmUser.email, TEST_EMAIL, "doConfirmUser with the correct email");

    // At this point the user should be displayed the "go confirm your address"
    // screen.

    // user_confirmed means the user has confirmed their email and the dialog
    // has received the "complete" message from /wsapi/user_creation_status.
    try {
      mediator.publish("user_confirmed");
    } catch(e) {
      // Exception is expected because as part of the user confirmation
      // process, before user_confirmed is called, email addresses are synced.
      // Addresses are not synced in this test.
      equal(e.toString(), "invalid email", "expected failure");
    }
  });


  test("cancel password_reset flow - go two steps back", function() {
    // we want to skip the "verify" screen of reset password and instead go two
    // screens back.  Do do this, we are simulating the steps necessary to get
    // to the password_reset flow.
    mediator.publish("authenticate");
    mediator.publish("forgot_password", undefined, { email: TEST_EMAIL });
    mediator.publish("password_reset");
    actions.info.doAuthenticate = {};
    mediator.publish("cancel_state");
    equal(actions.info.doAuthenticate.email, TEST_EMAIL, "authenticate called with the correct email");
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
    storage.addEmail(TEST_EMAIL, {});
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

  test("email_valid_and_ready, do not need to ask user whether it's their computer - redirect to email_ready", function() {
    setContextInfo("password");
    // First, set up the context info for the email.

    storage.addEmail(TEST_EMAIL, {});
    mediator.subscribe("email_ready", function() {
      ok(true, "redirect to email_ready");
      start();
    });
    mediator.publish("email_valid_and_ready", { email: TEST_EMAIL });
  });

  test("email_confirmed", function() {
    mediator.subscribe("email_chosen", function(msg, info) {
      equal(info.email, TEST_EMAIL, "correct email passed");
      start();
    });
    mediator.publish("email_staged", { email: TEST_EMAIL });
    // simulate the flow of a user being staged through to confirmation. Since
    // we are not actually doing the middle bits and saving off a cert for the
    // email address, we get an invalid email exception thrown.
    try {
      mediator.publish("email_confirmed");
    } catch(e) {
      equal(e.toString(), "invalid email", "expected failure");
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

  test("authenticate", function() {
    mediator.publish("authenticate", {
      email: TEST_EMAIL
    });

    equal(actions.info.doAuthenticate.email, TEST_EMAIL, "authenticate with testuser@testuser.com");
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


  asyncTest("email_chosen with secondary email, user must authenticate - call doAuthenticateWithRequiredEmail", function() {
    var email = TEST_EMAIL;
    storage.addEmail(email, { type: "secondary" });

    xhr.setContextInfo("auth_level", "assertion");

    mediator.publish("email_chosen", {
      email: email,
      complete: function() {
        equal(actions.called.doAuthenticateWithRequiredEmail, true, "doAuthenticateWithRequiredEmail called");
        start();
      }
    });
  });

  asyncTest("email_chosen with secondary email, user authenticated to secondary - redirect to email_valid_and_ready", function() {
    storage.addEmail(TEST_EMAIL, { type: "secondary" });
    xhr.setContextInfo("auth_level", "password");

    mediator.subscribe("email_valid_and_ready", function(msg, info) {
      equal(info.email, TEST_EMAIL, "correctly redirected to email_valid_and_ready with correct email");
      start();
    });

    mediator.publish("email_chosen", {
      email: TEST_EMAIL
    });
  });

  test("email_chosen with primary email - call doProvisionPrimaryUser", function() {
    // If the email is a primary, throw the user down the primary flow.
    // Doing so will catch cases where the primary certificate is expired
    // and the user must re-verify with their IdP. This flow will
    // generate its own assertion when ready.  For efficiency, we could
    // check here whether the cert is ready, but it is early days yet and
    // the format may change.
    var email = TEST_EMAIL;
    storage.addEmail(email, { type: "primary" });
    mediator.publish("email_chosen", { email: email });

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

    equal(error, "invalid email", "expected exception thrown");
  });

  test("null assertion generated - preserve original options in doPickEmail", function() {
    mediator.publish("start", {
      hostname: "http://example.com",
      privacyURL: "http://example.com/priv.html",
      tosURL: "http://example.com/tos.html"
    });
    mediator.publish("assertion_generated", { assertion: null });

    equal(actions.called.doPickEmail, true, "doPickEmail callled");
    equal(actions.info.doPickEmail.origin, "http://example.com", "hostname preserved");
    equal(actions.info.doPickEmail.privacyURL, "http://example.com/priv.html", "privacyURL preserved");
    equal(actions.info.doPickEmail.tosURL, "http://example.com/tos.html", "tosURL preserved");
  });

  test("add_email - call doAddEmail", function() {
    mediator.publish("add_email");

    equal(actions.called.doAddEmail, true, "doAddEmail called");
  });

  asyncTest("stage_email - first secondary email - call doSetPassword with cancelable=true", function() {
    mediator.publish("stage_email", {
      complete: function() {
        testHelpers.testObjectValuesEqual(actions.info.doSetPassword, {
          cancelable: true
        });
        start();
      }
    });
  });


  asyncTest("stage_email - second secondary email - call doStageEmail", function() {
    storage.addSecondaryEmail("testuser@testuser.com");

    mediator.publish("stage_email", {
      complete: function() {
        equal(actions.called.doStageEmail, true, "doStageEmail called");
        start();
      }
    });
  });

  asyncTest("stage_email first secondary requiredEmail - call doSetPassword with cancelable=false", function() {
    mediator.publish("start", { requiredEmail: TEST_EMAIL });
    mediator.publish("stage_email", {
      complete: function() {
        testHelpers.testObjectValuesEqual(actions.info.doSetPassword, {
          cancelable: false
        });
        start();
      }
    });
  });



}());
