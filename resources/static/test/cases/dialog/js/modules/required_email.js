/*jshint browser: true, forin: true, laxbreak: true */
/*global asyncTest: true, test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      xhr = bid.Mocks.xhr,
      user = bid.User,
      storage = bid.Storage,
      testHelpers = bid.TestHelpers,
      register = testHelpers.register,
      provisioning = bid.Mocks.Provisioning,
      origStart;


  module("dialog/js/modules/required_email", {
    setup: function() {
      origStart = start;
      var count = 0;
      start = function() {
        if(count) {
          throw "multiple starts in a test";
        }
        count++;
        origStart();
      };
      testHelpers.setup();
      $("#required_email").text("");
    },

    teardown: function() {
      start = origStart;
      if (controller) {
        try {
          controller.destroy();
        } catch(e) {
          // controller may have already been deleted.
        }
        controller = null;
      }
      testHelpers.setup();
    }
  });

  function createController(options) {
    controller = bid.Modules.RequiredEmail.create();
    controller.start(options);
  }

  function testPasswordSection() {
    equal($("#password_section").length, 1, "password section is there");
  }

  function testNoPasswordSection() {
    equal($("#password_section").length, 0, "password section is not there");
  }

  function testSignIn(email, cb) {
    var el = $("#required_email");
    equal(el.val() || el.text(), email, "email set correctly");
    equal($("#sign_in").length, 1, "sign in button shown");
    equal($("#verify_address").length, 0, "verify address not shown");
    cb && cb();
    start();
  }

  function testVerify(email, cb) {
    var el = $("#required_email");
    equal(el.val() || el.text(), email, "email set correctly");
    equal($("#sign_in").length, 0, "sign in button not shown");
    equal($("#verify_address").length, 1, "verify address shows");
    testNoPasswordSection();
    cb && cb();
    start();
  }

  function testMessageReceived(email, message) {
    xhr.setContextInfo("auth_level", "assertion");

    createController({
      email: email,
      ready: function() {
        register(message, function(item, info) {
          equal(info.email, email, message + " received with correct email");
          start();
        });

        controller.verifyAddress();
      }
    });
  }


  asyncTest("siteTOSPP specified - show TOS/PP", function() {
    var email = "registered@testuser.com";
    xhr.useResult("known_secondary");
    xhr.setContextInfo("auth_level", "password");

    createController({
      email: email,
      siteTOSPP: true,
      ready: function() {
        testHelpers.testRPTosPPShown();
        start();
      }
    });
  });

  asyncTest("known_secondary: user who is not authenticated - show password form", function() {
    var email = "registered@testuser.com";
    xhr.useResult("known_secondary");

    createController({
      email: email,
      ready: function() {
        testSignIn(email, testPasswordSection);
      }
    });
  });

  asyncTest("unknown_secondary: user who is not authenticated - kick over to new_user flow", function() {
    var email = "unregistered@testuser.com";
    xhr.useResult("unknown_secondary");

    register("new_user", function(item, info) {
      equal(info.email, email, "correct email");
      start();
    });

    createController({
      email: email
    });
  });

  asyncTest("primary: user who is authenticated, owns address, cert valid - sees signin screen", function() {
    var email = "testuser@testuser.com";

    xhr.setContextInfo("auth_level",  "assertion");
    storage.addEmail(email, { type: "primary", cert: "cert" });
    xhr.useResult("primary");

    createController({
      email: email,
      ready: function() {
        testSignIn(email);
      }
    });
  });

  asyncTest("primary: user who is authenticated, owns address, cert expired or invalid, authed with IdP - sees signin screen", function() {
    var email = "registered@testuser.com",
        msgInfo;

    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);
    storage.addEmail(email, { type: "primary" });

    createController({
      email: email,
      ready: function() {
        testSignIn(email);
      }
    });
  });

  asyncTest("primary: user who is authenticated, owns address, cert expired or invalid, not authed with IdP - redirected to 'primary_user'", function() {
    var email = "registered@testuser.com",
        msgInfo;

    xhr.useResult("primary");
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
    storage.addEmail(email, { type: "primary" });

    register("primary_user", function(msg, info) {
      msgInfo = info;
    });

    createController({
      email: email,
      ready: function() {
        equal(msgInfo.email, email, "correct email passed");
        start();
      }
    });
  });

  asyncTest("primary: user who is authenticated, does not own address, authed with IdP - user sees signin screen", function() {
    var email = "unregistered@testuser.com",
        msgInfo;

    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);

    createController({
      email: email,
      ready: function() {
        testSignIn(email);
      }
    });
  });

  asyncTest("primary: user who is authenticated, does not own address, not authed with IdP - redirected to 'primary_user'", function() {
    var email = "unregistered@testuser.com",
        msgInfo;

    xhr.useResult("primary");
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);

    register("primary_user", function(msg, info) {
      msgInfo = info;
    });

    createController({
      email: email,
      ready: function() {
        equal(msgInfo.email, email, "correct email passed");
        start();
      }
    });
  });

  asyncTest("primary: user who is not authenticated, authenticated with IdP - user sees sign in screen.", function() {
    var email = "unregistered@testuser.com";
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);

    createController({
      email: email,
      ready: function() {
        testSignIn(email, testNoPasswordSection);
      }
    });
  });

  asyncTest("primary: user who is not authenticated, not authenticated with IdP - redirects to 'primary_user'", function() {
    var email = "unregistered@testuser.com",
        msgInfo;

    register("primary_user", function(msg, info) {
      msgInfo = info;
    });

    xhr.useResult("primary");
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);

    createController({
      email: email,
      ready: function() {
        equal(msgInfo && msgInfo.email, "unregistered@testuser.com", "correct email address");
        start();
      }
    });
  });

  asyncTest("user who is not authenticated, XHR error", function() {
    xhr.useResult("ajaxError");
    var email = "registered@testuser.com";
    createController({
      email: email,
      ready: function() {
        ok(testHelpers.errorVisible(), "Error message is visible");
        start();
      }
    });
  });

  asyncTest("known_secondary: assertion authenticated, email belongs to user - user sees sign in screen with password field.", function() {
    xhr.setContextInfo("auth_level",  "assertion");

    var email = "registered@testuser.com";
    user.syncEmailKeypair(email, function() {
      createController({
        email: email,
        ready: function() {
          testSignIn(email, testPasswordSection);
        }
      });
    });
  });

  asyncTest("known_secondary: password authenticated, email belongs to user - user sees sign in screen, no password.", function() {
    xhr.setContextInfo("auth_level",  "password");

    var email = "registered@testuser.com";
    user.syncEmailKeypair(email, function() {
      createController({
        email: email,
        ready: function() {
          testSignIn(email, testNoPasswordSection);
        }
      });
    });
  });

  asyncTest("known_secondary: user who is authenticated, email belongs to another user - user sees verify screen", function() {
    xhr.setContextInfo("auth_level",  "password");

    var email = "registered@testuser.com";
    xhr.useResult("known_secondary");

    createController({
      email: email,
      ready: function() {
        // This means the current user is going to take the address from the other
        // account.
        testVerify(email);
      }
    });
  });

  asyncTest("unknown_secondary: user who is authenticated to password level - user sees verify screen", function() {
    xhr.setContextInfo("auth_level",  "password");
    xhr.useResult("unknown_secondary");

    var email = "unregistered@testuser.com";

    createController({
      email: email,
      auth_level: "password",
      ready: function() {
        testVerify(email);
      }
    });
  });

  asyncTest("unknown_secondary: user who is authenticated to assertion level, account already has password - user sees verify screen", function() {
    xhr.setContextInfo("auth_level",  "assertion");
    xhr.useResult("unknown_secondary");

    storage.addEmail("testuser@testuser.com", { type: "secondary" });

    var email = "unregistered@testuser.com";

    createController({
      email: email,
      auth_level: "assertion",
      ready: function() {
        testVerify(email);
      }
    });
  });

  asyncTest("unknown_secondary: user who is authenticated to assertion level, account needs password - stage_email triggered", function() {
    xhr.setContextInfo("auth_level",  "assertion");
    xhr.useResult("unknown_secondary");

    var email = "unregistered@testuser.com";

    register("stage_email", function(msg, info) {
      testHelpers.testObjectValuesEqual(info, { email: email });
      start();
    });

    createController({
      email: email,
      auth_level: "assertion"
    });
  });


  asyncTest("secondary: signIn of an authenticated user - generates an assertion, redirects to assertion_generated", function() {
    xhr.setContextInfo("auth_level",  "password");

    var email = "registered@testuser.com";
    user.syncEmailKeypair(email, function() {
      createController({
        email: email
      });

      var assertion;
      register("assertion_generated", function(item, info) {
        assertion = info.assertion;
      });

      controller.signIn(function() {
        ok(assertion, "we have an assertion");
        start();
      });
    });
  });

  asyncTest("secondary: signIn of a non-authenticated user with a good password - generates an assertion, redirects to assertion_generated", function() {
    var email = "testuser@testuser.com";
    xhr.useResult("known_secondary");

    createController({
      email: email,
      ready: function() {
        var assertion;
        register("assertion_generated", function(item, info) {
          assertion = info.assertion;
        });

        xhr.useResult("valid");

        $("#password").val("password");
        controller.signIn(function() {
          ok(assertion, "we have an assertion");
          start();
        });
      }
    });

  });


  asyncTest("secondary: signIn of a non-authenticated user with a bad password does not generate an assertion", function() {
    var email = "registered@testuser.com";
    xhr.useResult("known_secondary");

    createController({
      email: email,
      ready: function() {
        var assertion;

        register("assertion_generated", function(item, info) {
          ok(false, "this should not have been called");
          assertion = info.assertion;
        });

        xhr.useResult("invalid");
        $("#password").val("badpassword");
        controller.signIn(function() {
          // Since we are using the mock, we know the XHR result is going to be
          // back in less than 1000ms.  All we have to do is check whether an
          // assertion was generated, if so, bad jiji.
          equal(typeof assertion, "undefined", "assertion was never generated");
          start();
        });
      }
    });
  });

  asyncTest("primary: signIn of an non-authenticated user who is authenticated w/ IdP - redirects to 'primary_user'", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);
    var email = "unregistered@testuser.com";

    createController({
      email: email,
      ready: function() {
        var primaryEmail;

        register("primary_user", function(item, info) {
          primaryEmail = info.email;
        });

        controller.signIn(function() {
          equal(primaryEmail, email, "correct email passed to primary_user");
          start();
        });
      }
    });

  });

  asyncTest("verifyAddress of authenticated user, secondary address belongs to another user - redirects to 'stage_email'", function() {
    var email = "registered@testuser.com";
    xhr.useResult("known_secondary");

    testMessageReceived(email, "stage_email");
  });

  asyncTest("verifyAddress of authenticated user, unknown address - redirects to 'stage_email'", function() {
    var email = "unregistered@testuser.com";
    xhr.useResult("unknown_secondary");

    testMessageReceived(email, "stage_email");
  });

  asyncTest("verifyAddress of un-authenticated user, forgot password - redirect to 'forgot_password'", function() {
    var email = "registered@testuser.com",
        message = "forgot_password";

    createController({
      email: email,
      ready: function() {
        register(message, function(item, info) {
          equal(info.email, email, message + " received with correct email");
          start();
        });

        controller.forgotPassword();
      }
    });
  });

  asyncTest("cancel raises the 'cancel_state' message", function() {
    var email = "registered@testuser.com",
        message = "cancel_state";

    createController({
      email: email,
      secondary_auth: true,
      ready: function() {
        register(message, function(item, info) {
          ok(true, message + " received");
          start();
        });

        controller.cancel();
      }
    });
  });


}());

