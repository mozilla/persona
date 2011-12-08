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
      controllerMock;

  var ControllerMock = function() {}
  ControllerMock.prototype = {
    doOffline: function() {
      this.offline = true;
    },

    doConfirmUser: function(email) {
      this.email = email;
    },

    doEmailConfirmed: function() {
      this.emailConfirmed = true;
    },

    doSyncThenPickEmail: function() {
      // XXX rename syncEmails to something else, or have pickEmail do this?
      this.emailsSynced = true;
    },

    doPickEmail: function() {
      this.pickingEmail = true;
    },

    doForgotPassword: function(email) {
      this.email = email;
    },

    doAssertionGenerated: function(assertion) {
      // XXX what a horrible horrible name for a function
      this.assertion = assertion;
    },

    doAddEmail: function() {
      this.requestAddEmail = true;
    },

    doConfirmEmail: function(email) {
      this.email = email;
    },

    doNotMe: function() {
      this.notMe = true;
    },

    doAuthenticate: function(info) {
      // XXX Get rid of info and pass email directly
      this.email = info.email;
    },

    doCheckAuth: function() {
      this.checkingAuth = true;
    },

    doCancel: function() {
      this.cancelled = true;
    }

  };

  function createMachine() {
    machine = bid.StateMachine.create();
    controllerMock = new ControllerMock();
    machine.start({controller: controllerMock});
  }

  module("resources/state_machine", {
    setup: function() {
      createMachine();
    },

    teardown: function() {
      machine.stop();
    }
  });


  test("can create and start the machine", function() {
    ok(machine, "Machine has been created");
  });

  test("offline does offline", function() {
    mediator.publish("offline");

    equal(controllerMock.offline, true, "controller is offline");
  });
  
  test("user_staged", function() {
    // XXX rename user_staged to confirm_user or something to that effect.
    mediator.publish("user_staged", {
      email: "testuser@testuser.com"
    });

    equal(controllerMock.email, "testuser@testuser.com", "waiting for email confirmation for testuser@testuser.com");
  });

  test("user_confirmed", function() {
    mediator.publish("user_confirmed");

    ok(controllerMock.emailConfirmed, "user was confirmed");
  });

  test("authenticated", function() {
    mediator.publish("authenticated");

    ok(controllerMock.emailsSynced, "emails have been synced");
  });

  test("forgot_password", function() {
    mediator.publish("forgot_password", {
      email: "testuser@testuser.com"
    });
    equal(controllerMock.email, "testuser@testuser.com", "forgot password with the correct email");
  });

  test("reset_password", function() {
    // XXX how is this different from forgot_password?
    mediator.publish("reset_password", {
      email: "testuser@testuser.com"
    });
    equal(controllerMock.email, "testuser@testuser.com", "reset password with the correct email");
  });

  test("assertion_generated with null assertion", function() {
    mediator.publish("assertion_generated", {
      assertion: null
    });

    equal(controllerMock.pickingEmail, true, "now picking email because of null assertion");
  });

  test("assertion_generated with assertion", function() {
    mediator.publish("assertion_generated", {
      assertion: "assertion"
    });

    equal(controllerMock.assertion, "assertion", "assertion generated with good assertion");
  });

  test("add_email", function() {
    // XXX rename add_email to request_add_email
    mediator.publish("add_email");

    ok(controllerMock.requestAddEmail, "user wants to add an email");
  });

  test("email_confirmed", function() {
    mediator.publish("email_confirmed");

    ok(controllerMock.emailConfirmed, "user has confirmed the email");
  });

  test("cancel_state", function() {
    mediator.publish("pick_email");
    mediator.publish("add_email");

    controllerMock.pickingEmail = false;
    mediator.publish("cancel_state");

    ok(controllerMock.pickingEmail, "user is picking an email");
  });

  test("cancel_state", function() {
    mediator.publish("add_email");
    mediator.publish("email_staged", {
      email: "testuser@testuser.com" 
    });

    controllerMock.requestAddEmail = false;
    mediator.publish("cancel_state");

    ok(controllerMock.requestAddEmail, "Back to trying to add an email after cancelling stage");
  });

  test("notme", function() {
    mediator.publish("notme");

    ok(controllerMock.notMe, "notMe has been called");
  });

  test("auth", function() {
    mediator.publish("auth", {
      email: "testuser@testuser.com" 
    });

    equal(controllerMock.email, "testuser@testuser.com", "authenticate with testuser@testuser.com");
  });

  test("start", function() {
    mediator.publish("start");

    equal(controllerMock.checkingAuth, true, "checking auth on start");
  });

  test("cancel", function() {
    mediator.publish("cancel");

    equal(controllerMock.cancelled, true, "cancelled everything");
  });

}());
