/*jshint browsers:true, forin: true, laxbreak: true */
/*global steal: true, test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
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
steal.then(function() {
  "use strict";

  var el,
      controller,
      bid = BrowserID,
      xhr = bid.Mocks.xhr,
      user = bid.User,
      network = bid.Network,
      storage = bid.Storage,
      mediator = bid.Mediator,
      listeners = [];

  // XXX TODO Share this code with the other tests.
  function subscribe(message, cb) {
    listeners.push(mediator.subscribe(message, cb));
  }

  function unsubscribeAll() {
    var registration;
    while(registration = listeners.pop()) {
      mediator.unsubscribe(registration);
    }
  }

  module("controllers/required_email", {
    setup: function() {
      el = $("body");
      $("#error").hide();
      network.setXHR(xhr);
      storage.clear();
      xhr.useResult("valid");
      xhr.setContextInfo({
        authenticated: false
      });
      $("#required_email").text("");
    },

    teardown: function() {
      if (controller) {
        try {
          controller.destroy();
        } catch(e) {
          // controller may have already been deleted.
        }
        controller = null;
      }
      network.setXHR($);
      unsubscribeAll();
    }
  });

  function createController(options) {
    controller = bid.Modules.RequiredEmail.create();
    controller.start(options);
  }

  function testSignIn(email, cb) {
    setTimeout(function() {
      var el = $("#required_email");
      equal(el.val() || el.text(), email, "email set correctly");
      equal($("#sign_in").length, 1, "sign in button shown");
      equal($("#verify_address").length, 0, "verify address not shows");
      cb && cb();
      start();
    }, 200);
    stop();
  }

  function testVerify(email, cb) {
    setTimeout(function() {
      var el = $("#required_email");
      equal(el.val() || el.text(), email, "email set correctly");
      equal($("#sign_in").length, 0, "sign in button not shown");
      equal($("#verify_address").length, 1, "verify address shows");
      testNoPasswordSection();
      cb && cb();
      start();
    }, 200);
    stop();
  }

  function testPasswordSection() {
    equal($("#password_section").length, 1, "password section is there");
  }

  function testNoPasswordSection() {
    equal($("#password_section").length, 0, "password section is not there");
  }

  test("user who is not authenticated, email is registered", function() {
    var email = "registered@testuser.com";
    createController({
      email: email, 
      authenticated: false
    });

    testSignIn(email, testPasswordSection);
  });

  test("user who is not authenticated, email not registered", function() {
    var email = "unregistered@testuser.com";
    createController({
      email: email, 
      authenticated: false
    });

    testVerify(email);
  });

  test("user who is not authenticated, XHR error", function() {
    xhr.useResult("ajaxError");
    var email = "registered@testuser.com";
    createController({
      email: email, 
      authenticated: false
    });

    stop();

    setTimeout(function() {
      ok($("#error").is(":visible"), "Error message is visible");
      start();
    }, 100);
  });

  test("user who is authenticated, email belongs to user", function() {
    xhr.setContextInfo({
      authenticated: true 
    });

    var email = "registered@testuser.com";
    user.syncEmailKeypair(email, function() {
      createController({
        email: email, 
        authenticated: true
      });
    });

    testSignIn(email, testNoPasswordSection);
  });

  test("user who is authenticated, email belongs to another user", function() {
    xhr.setContextInfo({
      authenticated: true 
    });

    var email = "registered@testuser.com";
    createController({
      email: email, 
      authenticated: true
    });

    // This means the current user is going to take the address from the other 
    // account.
    testVerify(email);
  });

  test("user who is authenticated, but email unknown", function() {
    xhr.setContextInfo({
      authenticated: true 
    });

    var email = "unregistered@testuser.com";
    createController({
      email: email, 
      authenticated: true
    });

    testVerify(email);
  });

  
  test("signIn of an authenticated user generates an assertion", function() {
    xhr.setContextInfo({
      authenticated: true 
    });

    var email = "registered@testuser.com";
    user.syncEmailKeypair(email, function() {
      createController({
        email: email, 
        authenticated: true
      });

      subscribe("assertion_generated", function(item, info) {
        ok(info.assertion, "we have an assertion");
        start();
      });

      controller.signIn();
    });

    stop();
  });

  test("signIn of an non-authenticated user with a good password generates an assertion", function() {
    xhr.setContextInfo({
      authenticated: false
    });

    var email = "registered@testuser.com";
    createController({
      email: email, 
      authenticated: false
    });

    subscribe("assertion_generated", function(item, info) {
      ok(info.assertion, "we have an assertion");
      start();
    });

    $("#password").val("password");
    controller.signIn();

    stop();
  });


  test("signIn of an non-authenticated user with a bad password does not generate an assertion", function() {
    xhr.setContextInfo({
      authenticated: false
    });

    var email = "registered@testuser.com";
    createController({
      email: email, 
      authenticated: false
    });

    var assertion;

    subscribe("assertion_generated", function(item, info) {
      ok(false, "this should not have been called");
      assertion = info.assertion;
    });

    xhr.useResult("invalid");
    $("#password").val("badpassword");
    controller.signIn();

    setTimeout(function() {
      // Since we are using the mock, we know the XHR result is going to be 
      // back in less than 1000ms.  All we have to do is check whether an 
      // assertion was generated, if so, bad jiji.
      equal(typeof assertion, "undefined", "assertion was never generated");
      start();
    }, 1000);

    stop();
  });

  function testMessageReceived(email, message) {
    var authenticated = true;

    xhr.setContextInfo({
      authenticated: authenticated 
    });

    createController({
      email: email, 
      authenticated: authenticated
    });


    subscribe(message, function(item, info) {
      equal(info.email, email, message + " received with correct email");
      start();
    });

    controller.verifyAddress();
    stop();
  }

  test("verifyAddress of authenticated user, address belongs to another user", function() {
    var email = "registered@testuser.com";

    testMessageReceived(email, "email_staged");
  });

  test("verifyAddress of authenticated user, unknown address", function() {
    var email = "unregistered@testuser.com";

    testMessageReceived(email, "email_staged");
  });

  test("verifyAddress of un-authenticated user, forgot password", function() {
    var email = "registered@testuser.com",
        authenticated = false,
        message = "forgot_password";

    xhr.setContextInfo({
      authenticated: authenticated 
    });

    createController({
      email: email, 
      authenticated: authenticated
    });


    subscribe(message, function(item, info) {
      equal(info.email, email, message + " received with correct email");
      start();
    });

    controller.forgotPassword();
    stop();
  });

  test("cancel raises the cancel message", function() {
    var email = "registered@testuser.com",
        message = "cancel",
        authenticated = false;

    xhr.setContextInfo({
      authenticated: authenticated 
    });

    createController({
      email: email, 
      authenticated: authenticated
    });


    subscribe(message, function(item, info) {
      ok(true, message + " received");
      start();
    });

    controller.cancel();
    stop();
  });

});

