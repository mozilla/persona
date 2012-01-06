/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
(function() {
  "use strict";

  var bid = BrowserID,
      mediator = bid.Mediator,
      machine,
      actions,
      storage = bid.Storage,
      testHelpers = bid.TestHelpers;

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

  test("primary_user calls doProvisionPrimaryUser", function() {
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

    ok(actions.called.doSyncThenPickEmail, "doSyncThenPickEmail has been called");
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


  test("email_chosen with secondary email - call doEmailChosen", function() {
    var email = "testuser@testuser.com";
    storage.addEmail(email, { type: "secondary" });
    mediator.publish("email_chosen", { email: email });

    equal(actions.called.doEmailChosen, true, "doEmailChosen called");

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
