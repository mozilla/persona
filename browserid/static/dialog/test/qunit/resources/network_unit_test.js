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
steal.plugins("jquery", "funcunit/qunit").then("/dialog/resources/network", function() {
  "use strict";

  var testName;

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

    var subscriber = function() {
      ok(true, "xhr error notified application");
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
    }, function onFailure() {
      ok(true, "XHR failure should never pass");
      wrappedStart();
    });

    xhr.useResult("ajaxError");

    cb.apply(null, args);

    stop();
  }

  var network = BrowserID.Network,
      contextInfo = {
        server_time: new Date().getTime(),
        csrf_token: "csrf",
        authenticated: false
      };


  /**
   * This is the results table, the keys are the request type, url, and 
   * a "selector" for testing.  The right is the expected return value, already 
   * decoded.  If a result is "undefined", the request's error handler will be 
   * called.
   */
  var xhr = {
    results: {
      "get /wsapi/session_context valid": contextInfo,   
      "get /wsapi/session_context invalid": contextInfo,
      // We are going to test for XHR failures for session_context using 
      // call to serverTime.  We are going to use the flag contextAjaxError
      "get /wsapi/session_context ajaxError": contextInfo, 
      "get /wsapi/session_context contextAjaxError": undefined,  
      "post /wsapi/authenticate_user valid": { success: true },
      "post /wsapi/authenticate_user invalid": { success: false },
      "post /wsapi/authenticate_user ajaxError": undefined,
      "post /wsapi/complete_email_addition valid": { success: true },
      "post /wsapi/complete_email_addition invalid": { success: false },
      "post /wsapi/complete_email_addition ajaxError": undefined,
      "post /wsapi/stage_user valid": { success: true },
      "post /wsapi/stage_user invalid": { success: false },
      "post /wsapi/stage_user ajaxError": undefined,
      "get /wsapi/user_creation_status?email=address notcreated": undefined, // undefined because server returns 400 error
      "get /wsapi/user_creation_status?email=address pending": { status: "pending" },
      "get /wsapi/user_creation_status?email=address complete": { status: "complete" },
      "get /wsapi/user_creation_status?email=address ajaxError": undefined,
      "post /wsapi/complete_user_creation valid": { success: true },
      "post /wsapi/complete_user_creation invalid": { success: false },
      "post /wsapi/complete_user_creation ajaxError": undefined,
      "post /wsapi/logout valid": { success: true },
      "post /wsapi/logout ajaxError": undefined,
      "get /wsapi/have_email?email=address taken": { email_known: true },
      "get /wsapi/have_email?email=address nottaken" : { email_known: false },
      "get /wsapi/have_email?email=address ajaxError" : undefined,
      "post /wsapi/remove_email valid": { success: true },
      "post /wsapi/remove_email invalid": { success: false },
      "post /wsapi/remove_email ajaxError": undefined,
      "post /wsapi/account_cancel valid": { success: true },
      "post /wsapi/account_cancel invalid": { success: false },
      "post /wsapi/account_cancel ajaxError": undefined,
      "post /wsapi/stage_email valid": { success: true },
      "post /wsapi/stage_email invalid": { success: false },
      "post /wsapi/stage_email ajaxError": undefined,
      "get /wsapi/email_addition_status?email=address notcreated": undefined, // undefined because server returns 400 error
      "get /wsapi/email_addition_status?email=address pending": { status: "pending" },
      "get /wsapi/email_addition_status?email=address complete": { status: "complete" },
      "get /wsapi/email_addition_status?email=address ajaxError": undefined
    },

    useResult: function(result) {
      xhr.resultType = result;
    },

    getLastRequest: function() {
      return this.req;
    },

    ajax: function(obj) {
      //console.log("ajax request");
      var type = obj.type ? obj.type.toLowerCase() : "get";

      var req = this.req = {
        type: type,
        url: obj.url,
        data: obj.data
      };


      if(type === "post" && !obj.data.csrf) {
        ok(false, "missing csrf token on POST request");
      }

      var resName = req.type + " " + req.url + " " + xhr.resultType;
      var result = xhr.results[resName];

      if(result) {
        if(obj.success) {
          obj.success(result);
        }
      }
      else if (obj.error) {
        // Invalid result - either invalid URL, invalid GET/POST or 
        // invalid resultType
        obj.error();
      }
    }
  }


  module("network", {
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
    contextInfo.authenticated = true;
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
    contextInfo.authenticated = false;

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
    contextInfo.authenticated = false;

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

  wrappedAsyncTest("createUser with XHR failure", function() {
    notificationCheck(network.createUser, "validuser", "origin");
  });

  wrappedAsyncTest("createUser with XHR failure", function() {
    failureCheck(network.createUser, "validuser", "origin");
  });

  wrappedAsyncTest("checkUserRegistration with pending email", function() {
    xhr.useResult("pending");

    network.checkUserRegistration("address", function(status) {
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

    network.checkUserRegistration("address", function(status) {
      equal(status, "complete");
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("checkUserRegistration with XHR failure", function() {
    notificationCheck(network.checkUserRegistration, "address");
  });

  wrappedAsyncTest("checkUserRegistration with XHR failure", function() {
    failureCheck(network.checkUserRegistration, "address");
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
    xhr.useResult("taken");

    network.emailRegistered("address", function(taken) {
      equal(taken, true, "a taken email is marked taken");
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("emailRegistered with nottaken email", function() {
    xhr.useResult("nottaken");

    network.emailRegistered("address", function(taken) {
      equal(taken, false, "a not taken email is not marked taken");
      wrappedStart();
    }, function onFailure() {
      ok(false);
      wrappedStart();
    });

    stop();
  });

  wrappedAsyncTest("emailRegistered with XHR failure", function() {
    notificationCheck(network.emailRegistered, "address");
  });

  wrappedAsyncTest("emailRegistered with XHR failure", function() {
    failureCheck(network.emailRegistered, "address");
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

  wrappedAsyncTest("addEmail with XHR failure", function() {
    notificationCheck(network.addEmail, "address", "origin");
  });

  wrappedAsyncTest("addEmail with XHR failure", function() {
    failureCheck(network.addEmail, "address", "origin");
  });

  wrappedAsyncTest("checkEmailRegistration pending", function() {
    xhr.useResult("pending");

    network.checkEmailRegistration("address", function(status) {
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

    network.checkEmailRegistration("address", function(status) {
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
    contextInfo.server_time = new Date().getTime() - 1250;
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
