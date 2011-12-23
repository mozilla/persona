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

  var controller,
      el = $("body"),
      bid = BrowserID,
      storage = bid.Storage,
      network = bid.Network,
      xhr = bid.Mocks.xhr,
      emailRegistered = false,
      userCreated = true,
      mediator = bid.Mediator,
      registrations = [],
      testHelpers = bid.TestHelpers,
      register = testHelpers.register,
      provisioning = bid.Mocks.Provisioning;

  function reset() {
    emailRegistered = false;
    userCreated = true;
  }

  function createController(options) {
    options = options || {};
    controller = bid.Modules.Authenticate.create();
    controller.start(options);
  }

  module("controllers/authenticate", {
    setup: function() {
      reset();
      testHelpers.setup();
      createController();
    },

    teardown: function() {
      if (controller) {
        try {
          controller.destroy();
        } catch(e) {
          // may already be destroyed from close inside of the controller.
        }
      }
      reset();
      testHelpers.teardown();
    }
  });


  test("setting email address prefills address field", function() {
      controller.destroy();
      $("#email").val("");
      createController({ email: "registered@testuser.com" });
      equal($("#email").val(), "registered@testuser.com", "email prefilled");
  });

  function testUserUnregistered() {
    register("create_user", function() {
      ok(true, "email was valid, user not registered");
      start();
    });

    controller.checkEmail();
  }

  asyncTest("checkEmail with unknown secondary email, expect 'create_user' message", function() {
    $("#email").val("unregistered@testuser.com");
    xhr.useResult("unknown_secondary");

    testUserUnregistered();
  });

  asyncTest("checkEmail with email with leading/trailing whitespace, user not registered, expect 'create_user' message", function() {
    $("#email").val("    unregistered@testuser.com   ");
    xhr.useResult("unknown_secondary");

    testUserUnregistered();
  });

  asyncTest("checkEmail with normal email, user registered, expect 'enter_password' message", function() {
    $("#email").val("registered@testuser.com");
    xhr.useResult("known_secondary");

    register("enter_password", function() {
      ok(true, "email was valid, user registered");
      start();
    });

    controller.checkEmail();
  });

  asyncTest("checkEmail with email that has IdP support, expect 'primary_user' message", function() {
    $("#email").val("unregistered@testuser.com");
    xhr.useResult("primary");

    register("primary_user", function(msg, info) {
      equal(info.email, "unregistered@testuser.com", "email correctly passed");
      equal(info.auth, "https://auth_url", "IdP authentication URL passed");
      equal(info.prov, "https://prov_url", "IdP provisioning URL passed");
      start();
    });

    controller.checkEmail();
  });

  function testAuthenticated() {
    register("authenticated", function() {
      ok(true, "user authenticated as expected");
      start();
    });
    controller.authenticate();
  }

  asyncTest("normal authentication is kosher", function() {
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    testAuthenticated();
  });

  asyncTest("leading/trailing whitespace on the username is stripped for authentication", function() {
    $("#email").val("    registered@testuser.com    ");
    $("#password").val("password");

    testAuthenticated();
  });

  asyncTest("forgotPassword triggers forgot_password message", function() {
    $("#email").val("registered@testuser.com");

    register("forgot_password", function(msg, info) {
      equal(info.email, "registered@testuser.com", "forgot_password with correct email triggered");
      start();
    });

    controller.forgotPassword();
  });

  asyncTest("createUser with valid email", function() {
    $("#email").val("unregistered@testuser.com");
    xhr.useResult("unknown_secondary");

    register("user_staged", function(msg, info) {
      equal(info.email, "unregistered@testuser.com", "user_staged with correct email triggered");
      start();
    });

    controller.createUser();
  });

  asyncTest("createUser with invalid email", function() {
    $("#email").val("unregistered");

    var handlerCalled = false;
    register("user_staged", function(msg, info) {
      handlerCalled = true;
    });

    controller.createUser(function() {
      equal(handlerCalled, false, "bad jiji, user_staged should not have been called with invalid email");
      start();
    });
  });

  asyncTest("createUser with valid email but throttling", function() {
    $("#email").val("unregistered@testuser.com");

    var handlerCalled = false;
    register("user_staged", function(msg, info) {
      handlerCalled = true;
    });

    xhr.useResult("throttle");
    controller.createUser(function() {
      equal(handlerCalled, false, "bad jiji, user_staged should not have been called with throttling");
      equal(bid.Tooltip.shown, true, "tooltip is shown");
      start();
    });
  });

  asyncTest("createUser with valid email, XHR error", function() {
    $("#email").val("unregistered@testuser.com");

    var handlerCalled = false;
    register("user_staged", function(msg, info) {
      handlerCalled = true;
    });

    xhr.useResult("ajaxError");
    controller.createUser(function() {
      equal(handlerCalled, false, "bad jiji, user_staged should not have been called with XHR error");
      start();
    });
  });

}());

