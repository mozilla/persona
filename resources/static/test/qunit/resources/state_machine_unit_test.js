/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      mediator = bid.Mediator,
      machine,
      actions,
      storage = bid.Storage,
      testHelpers = bid.TestHelpers,
      xhr = bid.Mocks.xhr;

  var ActionsMock = function() {
    this.called = {};
    this.info = {};
  }
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
    machine = bid.StateMachine.create();
    actions = new ActionsMock();
    machine.start({controller: actions});
  }

  module("resources/state_machine", {
    setup: function() {
      testHelpers.setup();
      createMachine();
    },

    teardown: function() {
      testHelpers.teardown();
      machine.stop();
    }
  });


  test("can create and start the machine", function() {
    ok(machine, "Machine has been created");
  });

  test("attempt to create a state machine without a controller", function() {
    raises(function() {
      var badmachine = bid.StateMachine.create();
      badmachine.start();
    }, "start: controller must be specified", "creating a state machine without a controller fails");
  });

  test("offline does offline", function() {
    mediator.publish("offline");

    equal(actions.called.doOffline, true, "controller is offline");
  });

  test("user_staged", function() {
    // XXX rename user_staged to confirm_user or something to that effect.
    mediator.publish("user_staged", {
      email: "testuser@testuser.com"
    });

    equal(actions.info.doConfirmUser, "testuser@testuser.com", "waiting for email confirmation for testuser@testuser.com");
  });

  test("user_confirmed", function() {
    mediator.publish("user_confirmed");

    ok(actions.called.doEmailConfirmed, "user was confirmed");
  });

  test("primary_user with already provisioned primary user calls doEmailChosen", function() {
    storage.addEmail("testuser@testuser.com", { type: "primary", cert: "cert" });
    mediator.publish("primary_user", { email: "testuser@testuser.com" });
    ok(actions.called.doEmailChosen, "doEmailChosen called");
  });

  test("primary_user with unprovisioned primary user doProvisionPrimaryUser", function() {
    mediator.publish("primary_user", { email: "testuser@testuser.com" });
    ok(actions.called.doProvisionPrimaryUser, "doPrimaryUserProvisioned called");
  });

  test("primary_user_provisioned calls doEmailChosen", function() {
    mediator.publish("primary_user_provisioned", { email: "testuser@testuser.com" });
    ok(actions.called.doPrimaryUserProvisioned, "doPrimaryUserProvisioned called");
  });

  test("primary_user_unauthenticated calls doVerifyPrimaryUser", function() {
    mediator.publish("primary_user_unauthenticated");
    ok(actions.called.doVerifyPrimaryUser, "doVerifyPrimaryUser called");
  });

  test("primary_user_authenticating stops all modules", function() {
    try {
      mediator.publish("primary_user_authenticating");

      equal(machine.success, true, "success flag set");
    } catch(e) {
      // ignore exception, it tries shutting down all the modules.
    }
  });

  test("primary_user calls doProvisionPrimaryUser", function() {
    mediator.publish("primary_user", { email: "testuser@testuser.com", assertion: "assertion" });

    ok(actions.called.doProvisionPrimaryUser, "doProvisionPrimaryUser called");
  });

  test("primary_user_ready calls doEmailChosen", function() {
    mediator.publish("primary_user_ready", { email: "testuser@testuser.com", assertion: "assertion" });

    ok(actions.called.doEmailChosen, "doEmailChosen called");
  });

  test("authenticated", function() {
    mediator.publish("authenticated");

    ok(actions.called.doPickEmail, "doPickEmail has been called");
  });

  test("forgot_password", function() {
    mediator.publish("forgot_password", {
      email: "testuser@testuser.com",
      requiredEmail: true
    });
    equal(actions.info.doForgotPassword.email, "testuser@testuser.com", "correct email passed");
    equal(actions.info.doForgotPassword.requiredEmail, true, "correct requiredEmail passed");
  });

  test("reset_password", function() {
    // XXX how is this different from forgot_password?
    mediator.publish("reset_password", {
      email: "testuser@testuser.com"
    });
    equal(actions.info.doConfirmUser, "testuser@testuser.com", "reset password with the correct email");
  });

  test("assertion_generated with null assertion", function() {
    mediator.publish("assertion_generated", {
      assertion: null
    });

    equal(actions.called.doPickEmail, true, "now picking email because of null assertion");
  });

  test("assertion_generated with assertion", function() {
    mediator.publish("assertion_generated", {
      assertion: "assertion"
    });

    equal(actions.info.doAssertionGenerated, "assertion", "assertion generated with good assertion");
  });

  test("add_email", function() {
    // XXX rename add_email to request_add_email
    mediator.publish("add_email");

    ok(actions.called.doAddEmail, "user wants to add an email");
  });

  test("email_confirmed", function() {
    mediator.publish("email_confirmed");

    ok(actions.called.doEmailConfirmed, "user has confirmed the email");
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
      email: "testuser@testuser.com"
    });

    equal(actions.info.doAuthenticate.email, "testuser@testuser.com", "authenticate with testuser@testuser.com");
  });

  test("start with no required email address should go straight to checking auth", function() {
    mediator.publish("start");

    equal(actions.called.doCheckAuth, true, "checking auth on start");
  });

  test("start with invalid requiredEmail prints error screen", function() {
    mediator.publish("start", {
      requiredEmail: "bademail"
    });

    equal(actions.called.doError, true, "error screen is shown");
  });

  test("start with empty requiredEmail prints error screen", function() {
    mediator.publish("start", {
      requiredEmail: ""
    });

    equal(actions.called.doError, true, "error screen is shown");
  });

  test("start with valid requiredEmail goes to auth", function() {
    mediator.publish("start", {
      requiredEmail: "testuser@testuser.com"
    });

    equal(actions.called.doCheckAuth, true, "checking auth on start");
  });

  test("cancel", function() {
    mediator.publish("cancel");

    equal(actions.called.doCancel, true, "cancelled everything");
  });


  asyncTest("email_chosen with secondary email, user must authenticate - call doAuthenticateWithRequiredEmail", function() {
    var email = "testuser@testuser.com";
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

  asyncTest("email_chosen with secondary email, user authenticated to secondary - call doEmailChosen", function() {
    var email = "testuser@testuser.com";
    storage.addEmail(email, { type: "secondary" });
    xhr.setContextInfo("auth_level", "password");

    mediator.publish("email_chosen", {
      email: email,
      complete: function() {
        equal(actions.called.doEmailChosen, true, "doEmailChosen called");
        start();
      }
    });
  });

  test("email_chosen with primary email - call doProvisionPrimaryUser", function() {
    // If the email is a primary, throw the user down the primary flow.
    // Doing so will catch cases where the primary certificate is expired
    // and the user must re-verify with their IdP. This flow will
    // generate its own assertion when ready.  For efficiency, we could
    // check here whether the cert is ready, but it is early days yet and
    // the format may change.
    var email = "testuser@testuser.com";
    storage.addEmail(email, { type: "primary" });
    mediator.publish("email_chosen", { email: email });

    equal(actions.called.doProvisionPrimaryUser, true, "doProvisionPrimaryUser called");
  });

  test("email_chosen with invalid email - throw exception", function() {
    var email = "testuser@testuser.com",
        error;

    try {
      mediator.publish("email_chosen", { email: email });
    } catch(e) {
      error = e;
    }

    equal(error, "invalid email", "expected exception thrown");
  });

}());
