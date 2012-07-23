/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      helpers = bid.Helpers,
      dialogHelpers = helpers.Dialog,
      xhr = bid.Mocks.xhr,
      storage = bid.Storage,
      tooltip = bid.Tooltip,
      testHelpers = bid.TestHelpers,
      user = bid.User,
      provisioning = bid.Mocks.Provisioning,
      mediator = bid.Mediator,
      errorCB,
      expectedError = testHelpers.expectedXHRFailure,
      expectedMessage = testHelpers.expectedMessage,
      unexpectedMessage = testHelpers.unexpectedMessage,
      badError = testHelpers.unexpectedXHRFailure;

  var controllerMock = {
    publish: mediator.publish,
    getErrorDialog: function(info) {
      return function() {
        errorCB && errorCB(info);
      }
    }
  };

  module("dialog/js/misc/helpers", {
    setup: function() {
      testHelpers.setup();
      errorCB = null;
      errorCB = badError;
      user.init({
        provisioning: provisioning
      });
    },

    teardown: function() {
      testHelpers.teardown();
      user.reset();
    }
  });

  asyncTest("getAssertion happy case", function() {
    mediator.subscribe("assertion_generated", function(msg, info) {
      testHelpers.testKeysInObject(info, ["assertion"]);
    });

    storage.addEmail("registered@testuser.com", {});
    dialogHelpers.getAssertion.call(controllerMock, "registered@testuser.com", function(assertion) {
      ok(assertion, "assertion given to close");
      start();
    });
  });

  asyncTest("getAssertion with XHR error", function() {
    unexpectedMessage("assertion_generated");
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    storage.addEmail("registered@testuser.com", {});
    dialogHelpers.getAssertion.call(controllerMock, "registered@testuser.com", testHelpers.expectedFailure);
  });

  asyncTest("authenticateUser happy case", function() {
    expectedMessage("password_submit");
    expectedMessage("authentication_success");
    dialogHelpers.authenticateUser.call(controllerMock, "testuser@testuser.com", "password", function(authenticated) {
      equal(authenticated, true, "user is authenticated");
      start();
    });
  });

  asyncTest("authenticateUser invalid credentials", function() {
    xhr.useResult("invalid");
    expectedMessage("password_submit");
    expectedMessage("authentication_fail");
    dialogHelpers.authenticateUser.call(controllerMock, "testuser@testuser.com", "password", function(authenticated) {
      equal(authenticated, false, "user is not authenticated");
      start();
    });
  });

  asyncTest("authenticateUser XHR error", function() {
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    expectedMessage("password_submit");
    dialogHelpers.authenticateUser.call(controllerMock, "testuser@testuser.com", "password", testHelpers.unexpectedSuccess);
  });

  asyncTest("createUser with unknown secondary happy case, expect 'user_staged' message", function() {
    xhr.useResult("unknown_secondary");
    expectedMessage("user_staged", {
      email: "unregistered@testuser.com",
      password: "password"
    });

    dialogHelpers.createUser.call(controllerMock, "unregistered@testuser.com", "password", function(staged) {
      equal(staged, true, "user was staged");
      start();
    });
  });

  asyncTest("createUser with unknown secondary, user throttled", function() {
    unexpectedMessage("user_staged");

    xhr.useResult("throttle");
    dialogHelpers.createUser.call(controllerMock, "unregistered@testuser.com", "password", function(staged) {
      equal(staged, false, "user was not staged");
      start();
    });
  });

  asyncTest("createUser with XHR error", function() {
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    dialogHelpers.createUser.call(controllerMock, "registered@testuser.com", "password", testHelpers.unexpectedSuccess);
  });

  asyncTest("addEmail with primary email happy case, expects primary_user message", function() {
    xhr.useResult("primary");
    expectedMessage("primary_user", {
      add: true
    });

    dialogHelpers.addEmail.call(controllerMock, "unregistered@testuser.com", function(status) {
      ok(status, "correct status");
      start();
    });
  });

  asyncTest("addEmail with secondary email - trigger stage_email", function() {
    xhr.useResult("unknown_secondary");
    expectedMessage("stage_email", {
      email: "unregistered@testuser.com"
    });
    dialogHelpers.addEmail.call(controllerMock, "unregistered@testuser.com", function(success) {
      equal(success, true, "success status");
      start();
    });
  });

  asyncTest("addEmail with XHR error", function() {
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    dialogHelpers.addEmail.call(controllerMock, "unregistered@testuser.com", testHelpers.unexpectedSuccess);
  });

  asyncTest("addEmail trying to add an email the user already controls - prints a tooltip", function() {
    storage.addEmail("registered@testuser.com", {});
    dialogHelpers.addEmail.call(controllerMock, "registered@testuser.com", function(added) {
      equal(added, false, "email should not have been added");
      equal(bid.Tooltip.shown, true, "tooltip should be shown");
      start();
    });
  });

  asyncTest("addSecondaryEmail success - call `email_staged` with email and password", function() {

    mediator.subscribe("email_staged", function(msg, info) {
      testHelpers.testObjectValuesEqual(info, {
        email: "testuser@testuser.com",
        password: "password"
      });
      start();
    });

    dialogHelpers.addSecondaryEmail.call(controllerMock, "testuser@testuser.com", "password", function(added) {
      equal(added, true, "email reported as added");
    });
  });

  asyncTest("addSecondaryEmail throttled - tooltip displayed", function() {

    xhr.useResult("throttle");
    unexpectedMessage("email_staged");

    dialogHelpers.addSecondaryEmail.call(controllerMock, "testuser@testuser.com", "password", function(added) {
      equal(added, false, "email not added");
      testHelpers.testTooltipVisible();
      start();
    });
  });

  asyncTest("addSecondaryEmail with XHR error - error message displayed", function() {

    xhr.useResult("ajaxError");
    unexpectedMessage("email_staged");
    errorCB = expectedError;

    dialogHelpers.addSecondaryEmail.call(controllerMock, "testuser@testuser.com", "password", testHelpers.unexpectedSuccess);
  });

  asyncTest("resetPassword happy case", function() {
    expectedMessage("reset_password_staged", {
      email: "registered@testuser.com"
    });

    dialogHelpers.resetPassword.call(controllerMock, "registered@testuser.com", "password", function(reset) {
      ok(reset, "password reset");
      start();
    });
  });


  asyncTest("resetPassword throttled", function() {
    xhr.useResult("throttle");
    dialogHelpers.resetPassword.call(controllerMock, "registered@testuser.com", "password", function(reset) {
      equal(reset, false, "password not reset");
      start();
    });
  });

  asyncTest("resetPassword with XHR error", function() {
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    dialogHelpers.resetPassword.call(controllerMock, "registered@testuser.com", "password", testHelpers.unexpectedSuccess);
  });
}());



