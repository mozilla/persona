/*jshint browsers:true, forin: true, laxbreak: true */
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
      closeCB,
      errorCB,
      expectedError = testHelpers.expectedXHRFailure,
      badError = testHelpers.unexpectedXHRFailure;

  var controllerMock = {
    publish: function(message, info) {
      closeCB && closeCB(message, info);
    },

    getErrorDialog: function(info) {
      return function() {
        errorCB && errorCB(info);
      }
    }
  };

  function expectedClose(message, field, value) {
    return function(m, info) {
      equal(m, message, "correct message: " + message);

      if(field) {
        if(value) {
          equal(info[field], value, field + " has correct value of " + value);
        }
        else {
          ok(info[field], field + " has a value");
        }
      }
    }
  }


  function badClose() {
    ok(false, "close should have never been called");
  }

  module("resources/helpers", {
    setup: function() {
      testHelpers.setup();
      closeCB = errorCB = null;
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
    closeCB = expectedClose("assertion_generated", "assertion");

    storage.addEmail("registered@testuser.com", {});
    dialogHelpers.getAssertion.call(controllerMock, "registered@testuser.com", function(assertion) {
      ok(assertion, "assertion given to close");
      start();
    });
  });

  asyncTest("getAssertion with XHR error", function() {
    closeCB = badClose;
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    storage.addEmail("registered@testuser.com", {});
    dialogHelpers.getAssertion.call(controllerMock, "registered@testuser.com", testHelpers.unexpectedSuccess);
  });

  asyncTest("authenticateUser happy case", function() {
    dialogHelpers.authenticateUser.call(controllerMock, "testuser@testuser.com", "password", function(authenticated) {
      equal(authenticated, true, "user is authenticated");
      start();
    });
  });

  asyncTest("authenticateUser invalid credentials", function() {
    xhr.useResult("invalid");
    dialogHelpers.authenticateUser.call(controllerMock, "testuser@testuser.com", "password", function(authenticated) {
      equal(authenticated, false, "user is not authenticated");
      start();
    });
  });

  asyncTest("authenticateUser XHR error", function() {
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    dialogHelpers.authenticateUser.call(controllerMock, "testuser@testuser.com", "password", function() {
      ok(false, "unexpected success callback");
      start();
    });
  });

  asyncTest("createUser with unknown secondary happy case, expect 'user_staged' message", function() {
    xhr.useResult("unknown_secondary");
    closeCB = expectedClose("user_staged", "email", "unregistered@testuser.com");

    dialogHelpers.createUser.call(controllerMock, "unregistered@testuser.com", "password", function(staged) {
      equal(staged, true, "user was staged");
      start();
    });
  });

  asyncTest("createUser with unknown secondary, user throttled", function() {
    closeCB = badClose;

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
    closeCB = expectedClose("primary_user", "add", true);
    dialogHelpers.addEmail.call(controllerMock, "unregistered@testuser.com", function(status) {
      ok(status, "correct status");
      start();
    });
  });

  asyncTest("addEmail with unknown secondary email happy case", function() {
    xhr.useResult("unknown_secondary");
    closeCB = expectedClose("email_staged", "email", "unregistered@testuser.com");
    dialogHelpers.addEmail.call(controllerMock, "unregistered@testuser.com", function(status) {
      ok(status, "correct status");
      start();
    });
  });

  asyncTest("addEmail throttled", function() {
    xhr.useResult("throttle");
    dialogHelpers.addEmail.call(controllerMock, "unregistered@testuser.com", function(added) {
      equal(added, false, "email not added");
      start();
    });
  });

  asyncTest("addEmail with XHR error", function() {
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    dialogHelpers.addEmail.call(controllerMock, "unregistered@testuser.com", function(added) {
      ok(false, "unexpected close");
      start();
    });
  });

  asyncTest("addEmail trying to add an email the user already controls - prints a tooltip", function() {
    storage.addEmail("registered@testuser.com", {});
    dialogHelpers.addEmail.call(controllerMock, "registered@testuser.com", function(added) {
      equal(added, false, "email should not have been added");
      equal(bid.Tooltip.shown, true, "tooltip should be shown");
      start();
    });
  });

  asyncTest("resetPassword happy case", function() {
    closeCB = expectedClose("password_reset", "email", "registered@testuser.com");
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
    dialogHelpers.resetPassword.call(controllerMock, "registered@testuser.com", "password", function(reset) {
      ok(false, "unexpected close");
      start();
    });
  });
}());



