/*jshint browsers:true, forin: true, laxbreak: true */
/*global asyncTest: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID: true */
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
      xhr = bid.Mocks.xhr,
      testHelpers = bid.TestHelpers,
      TEST_EMAIL = "testuser@testuser.com";

  function notificationCheck(cb) {
    // Take the original arguments, take off the function.  Add any additional
    // arguments that were passed in, and then tack on the onSuccess and
    // onFailure to the end.  Then call the callback.
    var args = Array.prototype.slice.call(arguments, 1);

    xhr.useResult("ajaxError");

    var handle;

    var subscriber = function(message, info) {
      ok(true, "xhr error notified application");
      ok(info.network.url, "url is in network info");
      ok(info.network.type, "request type is in network info");
      equal(info.network.textStatus, "errorStatus", "textStatus is in network info");
      equal(info.network.errorThrown, "errorThrown", "errorThrown is in response info");
      start();
      mediator.unsubscribe(handle);
    };

    handle = mediator.subscribe("xhrError", subscriber);

    if (cb) {
      cb.apply(null, args);
    }
  }

  function unexpectedFailure() {
    return function() {
      ok(false, "unexpected failure");
      start();
    }
  }

  function failureCheck(cb) {
    // Take the original arguments, take off the function.  Add any additional
    // arguments that were passed in, and then tack on the onSuccess and
    // onFailure to the end.  Then call the callback.
    var args = Array.prototype.slice.call(arguments, 1);

    args.push(function onSuccess() {
      ok(false, "XHR failure should never pass");
      start();
    }, function onFailure(info) {
      ok(true, "XHR failure should never pass");
      ok(info.network.url, "url is in network info");
      ok(info.network.type, "request type is in network info");
      equal(info.network.textStatus, "errorStatus", "textStatus is in network info");
      equal(info.network.errorThrown, "errorThrown", "errorThrown is in response info");
      start();
    });

    xhr.useResult("ajaxError");

    cb.apply(null, args);
  }

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
    }, function onFailure() {
      ok(false, "valid authentication");
      start();
    });
  });

  asyncTest("authenticate with invalid user", function() {
    xhr.useResult("invalid");
    network.authenticate(TEST_EMAIL, "invalid", function onSuccess(authenticated) {
      equal(authenticated, false, "invalid authentication");
      start();
    }, function onFailure() {
      ok(false, "invalid authentication");
      start();
    });
  });

  asyncTest("authenticate with XHR failure, checking whether application is notified", function() {
    notificationCheck(network.authenticate, TEST_EMAIL, "ajaxError");
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
    xhr.useResult("ajaxError");

    network.authenticateWithAssertion(
      TEST_EMAIL,
      "test_assertion",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });


  asyncTest("checkAuth with valid authentication", function() {
    xhr.setContextInfo("authenticated", true);
    network.checkAuth(function onSuccess(authenticated) {
      equal(authenticated, true, "we have an authentication");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("checkAuth with invalid authentication", function() {
    xhr.useResult("invalid");
    xhr.setContextInfo("authenticated", false);

    network.checkAuth(function onSuccess(authenticated) {
      equal(authenticated, false, "we are not authenticated");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });



  asyncTest("checkAuth with XHR failure", function() {
    xhr.useResult("ajaxError");
    xhr.setContextInfo("authenticated", false);

    // Do not convert this to failureCheck, we do this manually because
    // checkAuth does not make an XHR request.  Since it does not make an XHR
    // request, we do not test whether the app is notified of an XHR failure
    network.checkAuth(function onSuccess() {
      ok(true, "checkAuth does not make an ajax call, all good");
      start();
    }, function onFailure() {
      ok(false, "checkAuth does not make an ajax call, should not fail");
      start();
    });

  });


  asyncTest("logout", function() {
    network.logout(function onSuccess() {
      ok(true, "we can logout");
      start();
    }, function onFailure() {
      ok(false, "logout failure");
      start();
    });
  });


  asyncTest("logout with XHR failure", function() {
    notificationCheck(network.logout);
  });

  asyncTest("logout with XHR failure", function() {
    failureCheck(network.logout);
  });


  asyncTest("complete_email_addition valid", function() {
    network.completeEmailRegistration("goodtoken", function onSuccess(proven) {
      equal(proven, true, "good token proved");
      start();
    }, function onFailure() {
      start();
    });

  });

  asyncTest("complete_email_addition with invalid token", function() {
    xhr.useResult("invalid");
    network.completeEmailRegistration("badtoken", function onSuccess(proven) {
      equal(proven, false, "bad token could not be proved");
      start();
    }, function onFailure() {
      start();
    });

  });

  asyncTest("complete_email_addition with XHR failure", function() {
    notificationCheck(network.completeEmailRegistration, "goodtoken");
  });

  asyncTest("complete_email_addition with XHR failure", function() {
    failureCheck(network.completeEmailRegistration, "goodtoken");
  });

  asyncTest("createUser with valid user", function() {
    network.createUser("validuser", "origin", function onSuccess(created) {
      ok(created);
      start();
    }, function onFailure() {
      start();
    });

  });

  asyncTest("createUser with invalid user", function() {
    xhr.useResult("invalid");
    network.createUser("invaliduser", "origin", function onSuccess(created) {
      equal(created, false);
      start();
    }, function onFailure() {
      start();
    });

  });

  asyncTest("createUser throttled", function() {
    xhr.useResult("throttle");

    network.createUser("validuser", "origin", function onSuccess(added) {
      equal(added, false, "throttled email returns onSuccess but with false as the value");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("createUser with XHR failure", function() {
    notificationCheck(network.createUser, "validuser", "origin");
  });

  asyncTest("createUser with XHR failure", function() {
    failureCheck(network.createUser, "validuser", "origin");
  });

  asyncTest("checkUserRegistration with pending email", function() {
    xhr.useResult("pending");

    network.checkUserRegistration("registered@testuser.com", function(status) {
      equal(status, "pending");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("checkUserRegistration with complete email", function() {
    xhr.useResult("complete");

    network.checkUserRegistration("registered@testuser.com", function(status) {
      equal(status, "complete");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("checkUserRegistration with XHR failure", function() {
    notificationCheck(network.checkUserRegistration, "registered@testuser.com");
  });

  asyncTest("checkUserRegistration with XHR failure", function() {
    failureCheck(network.checkUserRegistration, "registered@testuser.com");
  });

  asyncTest("completeUserRegistration with valid token", function() {
    network.completeUserRegistration("token", "password", function(registered) {
      ok(registered);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("completeUserRegistration with invalid token", function() {
    xhr.useResult("invalid");

    network.completeUserRegistration("token", "password", function(registered) {
      equal(registered, false);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("completeUserRegistration with XHR failure", function() {
    notificationCheck(network.completeUserRegistration, "token", "password");
  });

  asyncTest("completeUserRegistration with XHR failure", function() {
    failureCheck(network.completeUserRegistration, "token", "password");
  });

  asyncTest("cancelUser valid", function() {

    network.cancelUser(function() {
      // XXX need a test here.
      ok(true);
      start();
    }, function onFailure() {
      start();
    });

  });

  asyncTest("cancelUser invalid", function() {
    xhr.useResult("invalid");

    network.cancelUser(function() {
      // XXX need a test here.
      ok(true);
      start();
    }, function onFailure() {
      start();
    });

  });

  asyncTest("cancelUser with XHR failure", function() {
    notificationCheck(network.cancelUser);
  });

  asyncTest("cancelUser with XHR failure", function() {
    failureCheck(network.cancelUser);
  });

  asyncTest("emailRegistered with taken email", function() {
    network.emailRegistered("registered@testuser.com", function(taken) {
      equal(taken, true, "a taken email is marked taken");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("emailRegistered with nottaken email", function() {
    network.emailRegistered("unregistered@testuser.com", function(taken) {
      equal(taken, false, "a not taken email is not marked taken");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("emailRegistered with XHR failure", function() {
    notificationCheck(network.emailRegistered, "registered@testuser.com");
  });

  asyncTest("emailRegistered with XHR failure", function() {
    failureCheck(network.emailRegistered, "registered@testuser.com");
  });


  asyncTest("addSecondaryEmail valid", function() {
    network.addSecondaryEmail("address", "origin", function onSuccess(added) {
      ok(added);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });
  });

  asyncTest("addSecondaryEmail invalid", function() {
    xhr.useResult("invalid");
    network.addSecondaryEmail("address", "origin", function onSuccess(added) {
      equal(added, false);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });
  });

  asyncTest("addSecondaryEmail throttled", function() {
    xhr.useResult("throttle");

    network.addSecondaryEmail("address", "origin", function onSuccess(added) {
      equal(added, false, "throttled email returns onSuccess but with false as the value");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("addSecondaryEmail with XHR failure", function() {
    notificationCheck(network.addSecondaryEmail, "address", "origin");
  });

  asyncTest("addSecondaryEmail with XHR failure", function() {
    failureCheck(network.addSecondaryEmail, "address", "origin");
  });

  asyncTest("checkEmailRegistration pending", function() {
    xhr.useResult("pending");

    network.checkEmailRegistration("registered@testuser.com", function(status) {
      equal(status, "pending");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

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
    notificationCheck(network.checkEmailRegistration, "address");
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
    xhr.useResult("ajaxError");

    network.addEmailWithAssertion(
      "test_assertion",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });


  asyncTest("removeEmail valid", function() {
    network.removeEmail("validemail", function onSuccess() {
      // XXX need a test here;
      ok(true);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("removeEmail invalid", function() {
    xhr.useResult("invalid");

    network.removeEmail("invalidemail", function onSuccess() {
      // XXX need a test here;
      ok(true);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("removeEmail with XHR failure", function() {
    notificationCheck(network.removeEmail, "validemail");
  });

  asyncTest("removeEmail with XHR failure", function() {
    failureCheck(network.removeEmail, "invalidemail");
  });


  asyncTest("requestPasswordReset", function() {
    network.requestPasswordReset("address", "origin", function onSuccess() {
      // XXX need a test here;
      ok(true);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("requestPasswordReset with XHR failure", function() {
    notificationCheck(network.requestPasswordReset, "address", "origin");
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
    xhr.useResult("ajaxError");
    network.setPassword(
      "password",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
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
    notificationCheck();
    xhr.useResult("contextAjaxError");

    network.serverTime();
  });

  asyncTest("serverTime with XHR failure before context has been setup", function() {
    xhr.useResult("contextAjaxError");

    network.serverTime(function onSuccess(time) {
      ok(false, "XHR failure should never call success");
      start();
    }, function onFailure() {
      ok(true, "XHR failure should always call failure");
      start();
    });

  });

  asyncTest("codeVersion", function() {
    network.codeVersion(function onComplete(version) {
      equal(version, "ABC123", "version returned properly");
      start();
    }, function onFailure() {
      ok(false, "unexpected failure");
      start();
    });
  });

  asyncTest("codeVersion with XHR failure", function() {
    xhr.useResult("contextAjaxError");

    network.codeVersion(function onComplete(version) {
      ok(false, "XHR failure should never call complete");
      start();
    }, function onFailure() {
      ok(true, "XHR failure should always return failure");
      start();
    });
  });

  asyncTest("addressInfo with unknown secondary email", function() {
    xhr.useResult("unknown_secondary");

    network.addressInfo(TEST_EMAIL, function onComplete(data) {
      equal(data.type, "secondary", "type is secondary");
      equal(data.known, false, "address is unknown to BrowserID");
      start();
    }, unexpectedFailure);
  });

  asyncTest("addressInfo with known seconday email", function() {
    xhr.useResult("known_secondary");

    network.addressInfo(TEST_EMAIL, function onComplete(data) {
      equal(data.type, "secondary", "type is secondary");
      equal(data.known, true, "address is known to BrowserID");
      start();
    }, unexpectedFailure);
  });

  asyncTest("addressInfo with primary email", function() {
    xhr.useResult("primary");

    network.addressInfo(TEST_EMAIL, function onComplete(data) {
      equal(data.type, "primary", "type is primary");
      ok("auth" in data, "auth field exists");
      ok("prov" in data, "prov field exists");
      start();
    }, unexpectedFailure);
  });

  asyncTest("addressInfo with XHR failure", function() {
    xhr.useResult("ajaxError");
    failureCheck(network.addressInfo, TEST_EMAIL);
  });

  asyncTest("changePassword happy case, expect complete callback with true status", function() {
    network.changePassword("oldpassword", "newpassword", function onComplete(status) {
      equal(status, true, "calls onComplete with true status");
      start();
    }, function onFailure() {
      ok(false, "unexpected failure");
      start();
    });
  });

  asyncTest("changePassword with incorrect old password, expect complete callback with false status", function() {
    xhr.useResult("incorrectPassword");

    network.changePassword("oldpassword", "newpassword", function onComplete(status) {
      equal(status, false, "calls onComplete with false status");
      start();
    }, function onFailure() {
      ok(false, "unexpected failure");
      start();
    });
  });

  asyncTest("changePassword with XHR failure, expect error callback", function() {
    xhr.useResult("ajaxError");

    network.changePassword("oldpassword", "newpassword", function onComplete() {
      ok(false, "XHR failure should never call complete");
      start();
    }, function onFailure() {
      ok(true, "XHR failure should always call failure");
      start();
    });
  });

}());
