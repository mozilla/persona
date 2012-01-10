/*jshint browsers:true, forin: true, laxbreak: true */
/*global asyncTest: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      mediator = bid.Mediator,
      xhr = bid.Mocks.xhr,
      testHelpers = bid.TestHelpers,
      TEST_EMAIL = "testuser@testuser.com",
      failureCheck = testHelpers.failureCheck;

  var network = BrowserID.Network;

  module("shared/network", {
    setup: function() {
      testHelpers.setup();
    },
    teardown: function() {
      testHelpers.teardown();
    }
  });


  asyncTest("authenticate with valid user", function() {
    network.authenticate(TEST_EMAIL, "testuser", function onSuccess(authenticated) {
      equal(authenticated, true, "valid authentication");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("authenticate with invalid user", function() {
    xhr.useResult("invalid");
    network.authenticate(TEST_EMAIL, "invalid", function onSuccess(authenticated) {
      equal(authenticated, false, "invalid authentication");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("authenticate with XHR failure after context already setup", function() {
    failureCheck(network.authenticate, TEST_EMAIL, "ajaxError");
  });

  asyncTest("authenticateWithAssertion with valid email/assertioni, returns true status", function() {
    network.authenticateWithAssertion(TEST_EMAIL, "test_assertion", function(status) {
      equal(status, true, "user authenticated, status set to true");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("authenticateWithAssertion with invalid email/assertion", function() {
    xhr.useResult("invalid");

    network.authenticateWithAssertion(TEST_EMAIL, "test_assertion", function(status) {
      equal(status, false, "user not authenticated, status set to false");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("authenticateWithAssertion with XHR failure", function() {
    failureCheck(network.authenticateWithAssertion, TEST_EMAIL, "test_assertion");
  });

  asyncTest("checkAuth with valid authentication", function() {
    xhr.setContextInfo("auth_level", "primary");
    network.checkAuth(function onSuccess(authenticated) {
      equal(authenticated, "primary", "we have an authentication");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("checkAuth with invalid authentication", function() {
    xhr.useResult("invalid");
    xhr.setContextInfo("auth_level", undefined);

    network.checkAuth(function onSuccess(authenticated) {
      equal(authenticated, undefined, "we are not authenticated");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });



  asyncTest("checkAuth with XHR failure", function() {
    xhr.useResult("ajaxError");
    xhr.setContextInfo("auth_level", undefined);

    // Do not convert this to failureCheck, we do this manually because
    // checkAuth does not make an XHR request.  Since it does not make an XHR
    // request, we do not test whether the app is notified of an XHR failure
    network.checkAuth(function onSuccess() {
      ok(true, "checkAuth does not make an ajax call, all good");
      start();
    }, testHelpers.unexpectedFailure);
  });


  asyncTest("logout", function() {
    network.logout(function onSuccess() {
      ok(true, "we can logout");
      start();
    }, testHelpers.unexpectedFailure);
  });


  asyncTest("logout with XHR failure", function() {
    failureCheck(network.logout);
  });


  asyncTest("completeEmailRegistration valid", function() {
    network.completeEmailRegistration("goodtoken", "password", function onSuccess(proven) {
      equal(proven, true, "good token proved");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("completeEmailRegistration with invalid token", function() {
    xhr.useResult("invalid");
    network.completeEmailRegistration("badtoken", "password", function onSuccess(proven) {
      equal(proven, false, "bad token could not be proved");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("completeEmailRegistration with XHR failure", function() {
    failureCheck(network.completeEmailRegistration, "goodtoken", "password");
  });

  asyncTest("createUser with valid user", function() {
    network.createUser("validuser", "origin", function onSuccess(created) {
      ok(created);
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("createUser with invalid user", function() {
    xhr.useResult("invalid");
    network.createUser("invaliduser", "origin", function onSuccess(created) {
      equal(created, false);
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("createUser throttled", function() {
    xhr.useResult("throttle");

    network.createUser("validuser", "origin", function onSuccess(added) {
      equal(added, false, "throttled email returns onSuccess but with false as the value");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("createUser with XHR failure", function() {
    failureCheck(network.createUser, "validuser", "origin");
  });

  asyncTest("checkUserRegistration with pending email", function() {
    xhr.useResult("pending");

    network.checkUserRegistration("registered@testuser.com", function(status) {
      equal(status, "pending");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("checkUserRegistration with complete email", function() {
    xhr.useResult("complete");

    network.checkUserRegistration("registered@testuser.com", function(status) {
      equal(status, "complete");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("checkUserRegistration with XHR failure", function() {
    failureCheck(network.checkUserRegistration, "registered@testuser.com");
  });

  asyncTest("completeUserRegistration with valid token", function() {
    network.completeUserRegistration("token", "password", function(registered) {
      ok(registered);
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("completeUserRegistration with invalid token", function() {
    xhr.useResult("invalid");

    network.completeUserRegistration("token", "password", function(registered) {
      equal(registered, false);
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("completeUserRegistration with XHR failure", function() {
    failureCheck(network.completeUserRegistration, "token", "password");
  });

  asyncTest("cancelUser valid", function() {

    network.cancelUser(function() {
      // XXX need a test here.
      ok(true);
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("cancelUser invalid", function() {
    xhr.useResult("invalid");

    network.cancelUser(function() {
      // XXX need a test here.
      ok(true);
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("cancelUser with XHR failure", function() {
    failureCheck(network.cancelUser);
  });

  asyncTest("emailRegistered with taken email", function() {
    network.emailRegistered("registered@testuser.com", function(taken) {
      equal(taken, true, "a taken email is marked taken");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("emailRegistered with nottaken email", function() {
    network.emailRegistered("unregistered@testuser.com", function(taken) {
      equal(taken, false, "a not taken email is not marked taken");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("emailRegistered with XHR failure", function() {
    failureCheck(network.emailRegistered, "registered@testuser.com");
  });


  asyncTest("addSecondaryEmail valid", function() {
    network.addSecondaryEmail("address", "origin", function onSuccess(added) {
      ok(added);
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("addSecondaryEmail invalid", function() {
    xhr.useResult("invalid");
    network.addSecondaryEmail("address", "origin", function onSuccess(added) {
      equal(added, false);
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("addSecondaryEmail throttled", function() {
    xhr.useResult("throttle");

    network.addSecondaryEmail("address", "origin", function onSuccess(added) {
      equal(added, false, "throttled email returns onSuccess but with false as the value");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("addSecondaryEmail with XHR failure", function() {
    failureCheck(network.addSecondaryEmail, "address", "origin");
  });

  asyncTest("checkEmailRegistration pending", function() {
    xhr.useResult("pending");

    network.checkEmailRegistration("registered@testuser.com", function(status) {
      equal(status, "pending");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("checkEmailRegistration complete", function() {
    xhr.useResult("complete");

    network.checkEmailRegistration("registered@testuser.com", function(status) {
      equal(status, "complete");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("checkEmailRegistration with XHR failure", function() {
    failureCheck(network.checkEmailRegistration, "address");
  });


  asyncTest("addEmailWithAssertion, user not authenticated or invalid assertion, returns false status", function() {
    xhr.useResult("invalid");

    network.addEmailWithAssertion("test_assertion", function(status) {
      equal(status, false, "email not added, status set to false");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("addEmailWithAssertion valid asserton, returns true status", function() {
    network.addEmailWithAssertion("test_assertion", function(status) {
      equal(status, true, "email added, status set to true");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("addEmailWithAssertion with XHR failure", function() {
    failureCheck(network.addEmailWithAssertion, "test_assertion");
  });


  asyncTest("emailForVerificationToken with XHR failure", function() {
    failureCheck(network.emailForVerificationToken, "token");
  });

  asyncTest("emailForVerificationToken with invalid token - returns null result", function() {
    xhr.useResult("invalid");

    network.emailForVerificationToken("token", function(result) {
      equal(result, null, "invalid token returns null result");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("emailForVerificationToken that needs password - returns needs_password and email address", function() {
    xhr.useResult("needsPassword");

    network.emailForVerificationToken("token", function(result) {
      equal(result.needs_password, true, "needs_password correctly set to true");
      equal(result.email, "testuser@testuser.com", "email address correctly added");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("emailForVerificationToken that does not need password", function() {
    network.emailForVerificationToken("token", function(result) {
      equal(result.needs_password, false, "needs_password correctly set to false");
      equal(result.email, "testuser@testuser.com", "email address correctly added");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("removeEmail valid", function() {
    network.removeEmail("validemail", function onSuccess() {
      // XXX need a test here;
      ok(true);
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("removeEmail invalid", function() {
    xhr.useResult("invalid");

    network.removeEmail("invalidemail", function onSuccess() {
      // XXX need a test here;
      ok(true);
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("removeEmail with XHR failure", function() {
    failureCheck(network.removeEmail, "invalidemail");
  });


  asyncTest("requestPasswordReset", function() {
    network.requestPasswordReset("address", "origin", function onSuccess() {
      // XXX need a test here;
      ok(true);
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("requestPasswordReset with XHR failure", function() {
    failureCheck(network.requestPasswordReset, "address", "origin");
  });

  asyncTest("setPassword happy case expects true status", function() {
    network.setPassword("password", function onComplete(status) {
      equal(status, true, "correct status");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("setPassword with XHR failure", function() {
    failureCheck(network.setPassword, "password");
  });

  asyncTest("serverTime", function() {
    // I am forcing the server time to be 1.25 seconds off.
    xhr.setContextInfo("server_time", new Date().getTime() - 1250);
    network.serverTime(function onSuccess(time) {
      var diff = Math.abs((new Date()) - time);
      equal(1245 < diff && diff < 1255, true, "server time and local time should be less than 100ms different (is " + diff + "ms different)");
      // XXX by stomlinson - I think this is an incorrect test.  The time returned here is the
      // time as it is on the server, which could be more than 100ms off of
      // what the local machine says it is.
      //equal(Math.abs(diff) < 100, true, "server time and local time should be less than 100ms different (is " + diff + "ms different)");
      start();
    }, function onfailure() {
      start();
    });

  });

  asyncTest("serverTime with XHR failure before context has been setup", function() {
    xhr.useResult("contextAjaxError");

    failureCheck(network.serverTime);
  });

  asyncTest("codeVersion", function() {
    network.codeVersion(function onComplete(version) {
      equal(version, "ABC123", "version returned properly");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("codeVersion with XHR failure", function() {
    xhr.useResult("contextAjaxError");

    failureCheck(network.codeVersion);
  });

  asyncTest("addressInfo with unknown secondary email", function() {
    xhr.useResult("unknown_secondary");

    network.addressInfo(TEST_EMAIL, function onComplete(data) {
      equal(data.type, "secondary", "type is secondary");
      equal(data.known, false, "address is unknown to BrowserID");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("addressInfo with known seconday email", function() {
    xhr.useResult("known_secondary");

    network.addressInfo(TEST_EMAIL, function onComplete(data) {
      equal(data.type, "secondary", "type is secondary");
      equal(data.known, true, "address is known to BrowserID");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("addressInfo with primary email", function() {
    xhr.useResult("primary");

    network.addressInfo(TEST_EMAIL, function onComplete(data) {
      equal(data.type, "primary", "type is primary");
      ok("auth" in data, "auth field exists");
      ok("prov" in data, "prov field exists");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("addressInfo with XHR failure", function() {
    failureCheck(network.addressInfo, TEST_EMAIL);
  });

  asyncTest("changePassword happy case, expect complete callback with true status", function() {
    network.changePassword("oldpassword", "newpassword", function onComplete(status) {
      equal(status, true, "calls onComplete with true status");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("changePassword with incorrect old password, expect complete callback with false status", function() {
    xhr.useResult("incorrectPassword");

    network.changePassword("oldpassword", "newpassword", function onComplete(status) {
      equal(status, false, "calls onComplete with false status");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("changePassword with XHR failure, expect error callback", function() {
    failureCheck(network.changePassword, "oldpassword", "newpassword");
  });

}());
