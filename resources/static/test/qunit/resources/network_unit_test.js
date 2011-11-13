/*jshint browsers:true, forin: true, laxbreak: true */
/*global wrappedAsyncTest: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID: true */
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
steal.plugins("jquery", "funcunit/qunit").then("/resources/network", function() {
  "use strict";

  var testName,
  xhr = BrowserID.Mocks.xhr;

  function wrappedAsyncTest(name, test) {
    asyncTest(name, function() {
      testName = name;
      test();
    });
  }

  function wrappedStart() {
    console.log("start: " + testName);
    start();
  }

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
      wrappedStart();
      OpenAjax.hub.unsubscribe(handle);
    };

    handle = OpenAjax.hub.subscribe("xhrError", subscriber);

    if (cb) {
      cb.apply(null, args);
    }

    stop();
  }

  function failureCheck(cb) {
    // Take the original arguments, take off the function.  Add any additional
    // arguments that were passed in, and then tack on the onSuccess and
    // onFailure to the end.  Then call the callback.
    var args = Array.prototype.slice.call(arguments, 1);

    args.push(function onSuccess(authenticated) {
      ok(false, "XHR failure should never pass");
      wrappedStart();
    }, function onFailure(info) {
      ok(true, "XHR failure should never pass");
      ok(info.network.url, "url is in network info");
      ok(info.network.type, "request type is in network info");
      equal(info.network.textStatus, "errorStatus", "textStatus is in network info");
      equal(info.network.errorThrown, "errorThrown", "errorThrown is in response info");
      wrappedStart();
    });

    xhr.useResult("ajaxError");

    cb.apply(null, args);

    stop();
  }

  var network = BrowserID.Network;

  module("/resources/network", {
    setup: function() {
      network.setXHR(xhr);
      xhr.useResult("valid");
    },
    teardown: function() {
      network.setXHR($);
    }
  });


  wrappedAsyncTest("authenticate with valid user", function() {
    network.authenticate("testuser@testuser.com", "testuser", function onSuccess(authenticated) {
      equal(authenticated, true, "valid authentication");
      wrappedStart();
    }, function onFailure() {
      ok(false, "valid authentication");
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("authenticate with invalid user", function() {
    xhr.useResult("invalid");
    network.authenticate("testuser@testuser.com", "invalid", function onSuccess(authenticated) {
      equal(authenticated, false, "invalid authentication");
      wrappedStart();
    }, function onFailure() {
      ok(false, "invalid authentication");
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("authenticate with XHR failure, checking whether application is notified", function() {
    notificationCheck(network.authenticate, "testuser@testuser.com", "ajaxError");
  });

  wrappedAsyncTest("authenticate with XHR failure after context already setup", function() {
    failureCheck(network.authenticate, "testuser@testuser.com", "ajaxError");
  });


  wrappedAsyncTest("checkAuth with valid authentication", function() {
    xhr.setContextInfo("authenticated", true);
    network.checkAuth(function onSuccess(authenticated) {
      equal(authenticated, true, "we have an authentication");
      wrappedStart();
    }, function onFailure() {
      ok(false, "checkAuth failure");
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("checkAuth with invalid authentication", function() {
    xhr.useResult("invalid");
    xhr.setContextInfo("authenticated", false);

    network.checkAuth(function onSuccess(authenticated) {
      equal(authenticated, false, "we are not authenticated");
      wrappedStart();
    }, function onFailure() {
      ok(false, "checkAuth failure");
      wrappedStart();
    });

    stop();
  });



  wrappedAsyncTest("checkAuth with XHR failure", function() {
    xhr.useResult("ajaxError");
    xhr.setContextInfo("authenticated", false);

    // Do not convert this to failureCheck, we do this manually because
    // checkAuth does not make an XHR request.  Since it does not make an XHR
    // request, we do not test whether the app is notified of an XHR failure
    network.checkAuth(function onSuccess() {
      ok(true, "checkAuth does not make an ajax call, all good");
      wrappedStart();
    }, function onFailure() {
      ok(false, "checkAuth does not make an ajax call, should not fail");
      wrappedStart();
    });

    stop();
  });


  wrappedAsyncTest("logout", function() {
    network.logout(function onSuccess() {
      ok(true, "we can logout");
      wrappedStart();
    }, function onFailure() {
      ok(false, "logout failure");
      wrappedStart();
    });

    stop();
  });


  wrappedAsyncTest("logout with XHR failure", function() {
    notificationCheck(network.logout);
  });

  wrappedAsyncTest("logout with XHR failure", function() {
    failureCheck(network.logout);
  });


  wrappedAsyncTest("complete_email_addition valid", function() {
    network.completeEmailRegistration("goodtoken", function onSuccess(proven) {
      equal(proven, true, "good token proved");
      wrappedStart();
    }, function onFailure() {
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("complete_email_addition with invalid token", function() {
    xhr.useResult("invalid");
    network.completeEmailRegistration("badtoken", function onSuccess(proven) {
      equal(proven, false, "bad token could not be proved");
      wrappedStart();
    }, function onFailure() {
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("complete_email_addition with XHR failure", function() {
    notificationCheck(network.completeEmailRegistration, "goodtoken");
  });

  wrappedAsyncTest("complete_email_addition with XHR failure", function() {
    failureCheck(network.completeEmailRegistration, "goodtoken");
  });

  wrappedAsyncTest("createUser with valid user", function() {
    network.createUser("validuser", "origin", function onSuccess(created) {
      ok(created);
      wrappedStart();
    }, function onFailure() {
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("createUser with invalid user", function() {
    xhr.useResult("invalid");
    network.createUser("invaliduser", "origin", function onSuccess(created) {
      equal(created, false);
      wrappedStart();
    }, function onFailure() {
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("createUser throttled", function() {
    xhr.useResult("throttle");

    network.createUser("validuser", "origin", function onSuccess(added) {
      equal(added, false, "throttled email returns onSuccess but with false as the value");
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("createUser with XHR failure", function() {
    notificationCheck(network.createUser, "validuser", "origin");
  });

  wrappedAsyncTest("createUser with XHR failure", function() {
    failureCheck(network.createUser, "validuser", "origin");
  });

  wrappedAsyncTest("checkUserRegistration with pending email", function() {
    xhr.useResult("pending");

    network.checkUserRegistration("registered@testuser.com", function(status) {
      equal(status, "pending");
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("checkUserRegistration with complete email", function() {
    xhr.useResult("complete");

    network.checkUserRegistration("registered@testuser.com", function(status) {
      equal(status, "complete");
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("checkUserRegistration with XHR failure", function() {
    notificationCheck(network.checkUserRegistration, "registered@testuser.com");
  });

  wrappedAsyncTest("checkUserRegistration with XHR failure", function() {
    failureCheck(network.checkUserRegistration, "registered@testuser.com");
  });

  wrappedAsyncTest("completeUserRegistration with valid token", function() {
    network.completeUserRegistration("token", "password", function(registered) {
      ok(registered);
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("completeUserRegistration with invalid token", function() {
    xhr.useResult("invalid");

    network.completeUserRegistration("token", "password", function(registered) {
      equal(registered, false);
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("completeUserRegistration with XHR failure", function() {
    notificationCheck(network.completeUserRegistration, "token", "password");
  });

  wrappedAsyncTest("completeUserRegistration with XHR failure", function() {
    failureCheck(network.completeUserRegistration, "token", "password");
  });

  wrappedAsyncTest("cancelUser valid", function() {

    network.cancelUser(function() {
      // XXX need a test here.
      ok(true);
      wrappedStart();
    }, function onFailure() {
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("cancelUser invalid", function() {
    xhr.useResult("invalid");

    network.cancelUser(function() {
      // XXX need a test here.
      ok(true);
      wrappedStart();
    }, function onFailure() {
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("cancelUser with XHR failure", function() {
    notificationCheck(network.cancelUser);
  });

  wrappedAsyncTest("cancelUser with XHR failure", function() {
    failureCheck(network.cancelUser);
  });

  wrappedAsyncTest("emailRegistered with taken email", function() {
    network.emailRegistered("registered@testuser.com", function(taken) {
      equal(taken, true, "a taken email is marked taken");
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("emailRegistered with nottaken email", function() {
    network.emailRegistered("unregistered@testuser.com", function(taken) {
      equal(taken, false, "a not taken email is not marked taken");
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("emailRegistered with XHR failure", function() {
    notificationCheck(network.emailRegistered, "registered@testuser.com");
  });

  wrappedAsyncTest("emailRegistered with XHR failure", function() {
    failureCheck(network.emailRegistered, "registered@testuser.com");
  });


  wrappedAsyncTest("addEmail valid", function() {
    network.addEmail("address", "origin", function onSuccess(added) {
      ok(added);
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("addEmail invalid", function() {
    xhr.useResult("invalid");
    network.addEmail("address", "origin", function onSuccess(added) {
      equal(added, false);
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("addEmail throttled", function() {
    xhr.useResult("throttle");

    network.addEmail("address", "origin", function onSuccess(added) {
      equal(added, false, "throttled email returns onSuccess but with false as the value");
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("addEmail with XHR failure", function() {
    notificationCheck(network.addEmail, "address", "origin");
  });

  wrappedAsyncTest("addEmail with XHR failure", function() {
    failureCheck(network.addEmail, "address", "origin");
  });

  wrappedAsyncTest("checkEmailRegistration pending", function() {
    xhr.useResult("pending");

    network.checkEmailRegistration("registered@testuser.com", function(status) {
      equal(status, "pending");
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("checkEmailRegistration complete", function() {
    xhr.useResult("complete");

    network.checkEmailRegistration("registered@testuser.com", function(status) {
      equal(status, "complete");
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("checkEmailRegistration with XHR failure", function() {
    notificationCheck(network.checkEmailRegistration, "address");
  });

  wrappedAsyncTest("checkEmailRegistration with XHR failure", function() {
    failureCheck(network.checkEmailRegistration, "address");
  });


  wrappedAsyncTest("removeEmail valid", function() {
    network.removeEmail("validemail", function onSuccess() {
      // XXX need a test here;
      ok(true);
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("removeEmail invalid", function() {
    xhr.useResult("invalid");

    network.removeEmail("invalidemail", function onSuccess() {
      // XXX need a test here;
      ok(true);
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("removeEmail with XHR failure", function() {
    notificationCheck(network.removeEmail, "validemail");
  });

  wrappedAsyncTest("removeEmail with XHR failure", function() {
    failureCheck(network.removeEmail, "invalidemail");
  });


  wrappedAsyncTest("requestPasswordReset", function() {
    network.requestPasswordReset("address", "origin", function onSuccess() {
      // XXX need a test here;
      ok(true);
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("requestPasswordReset with XHR failure", function() {
    notificationCheck(network.requestPasswordReset, "address", "origin");
  });

  wrappedAsyncTest("requestPasswordReset with XHR failure", function() {
    failureCheck(network.requestPasswordReset, "address", "origin");
  });

  wrappedAsyncTest("resetPassword", function() {
    network.resetPassword("password", function onSuccess() {
      // XXX need a test here;
      ok(true);
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("resetPassword with XHR failure", function() {
    xhr.useResult("ajaxError");
/*
    the body of this function is not yet written

    network.resetPassword("password", function onSuccess() {
      ok(false, "XHR failure should never call success");
      wrappedStart();
    }, function onFailure() {
      ok(true, "XHR failure should always call failure");
      wrappedStart();
    });
    stop();
*/
    start();
  });

  wrappedAsyncTest("changePassword", function() {
    network.changePassword("oldpassword", "newpassword", function onSuccess() {
      // XXX need a real wrappedAsyncTest here.
      ok(true);
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("changePassword with XHR failure", function() {
    xhr.useResult("ajaxError");

    /*
    the body of this function is not yet written.
    network.changePassword("oldpassword", "newpassword", function onSuccess() {
      ok(false, "XHR failure should never call success");
      wrappedStart();
    }, function onFailure() {
      ok(true, "XHR failure should always call failure");
      wrappedStart();
    });

    stop();
    */
    start();
  });

  wrappedAsyncTest("serverTime", function() {
    // I am forcing the server time to be 1.25 seconds off.
    xhr.setContextInfo("server_time", new Date().getTime() - 1250);
    network.serverTime(function onSuccess(time) {
      var diff = Math.abs((new Date()) - time);
      equal(1245 < diff && diff < 1255, true, "server time and local time should be less than 100ms different (is " + diff + "ms different)");
      // XXX by stomlinson - I think this is an incorrect test.  The time returned here is the
      // time as it is on the server, which could be more than 100ms off of
      // what the local machine says it is.
      //equal(Math.abs(diff) < 100, true, "server time and local time should be less than 100ms different (is " + diff + "ms different)");
      wrappedStart();
    }, function onfailure() {
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("serverTime with XHR failure before context has been setup", function() {
    notificationCheck();
    xhr.useResult("contextAjaxError");

    network.serverTime();
  });

  wrappedAsyncTest("serverTime with XHR failure before context has been setup", function() {
    xhr.useResult("contextAjaxError");

    network.serverTime(function onSuccess(time) {
      ok(false, "XHR failure should never call success");
      wrappedStart();
    }, function onFailure() {
      ok(true, "XHR failure should always call failure");
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("body offline message triggers offline message", function() {
    OpenAjax.hub.subscribe("offline", function() {
      ok(true, "offline event caught and application notified");
      start();
    });

    $("body").trigger("offline");
    stop();
  });
});
