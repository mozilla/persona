/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      network = bid.Network,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      WinChanMock = bid.Mocks.WinChan,
      provisioning = bid.Mocks.Provisioning,
      WindowMock = bid.Mocks.WindowMock,
      testHelpers = bid.TestHelpers,
      testDocumentRedirected = testHelpers.testDocumentRedirected,
      testDocumentNotRedirected = testHelpers.testDocumentNotRedirected,
      testHasClass = testHelpers.testHasClass,
      pageHelpers = bid.PageHelpers,
      docMock,
      controller,
      winchan;

  function createController(options) {
    if (controller) controller.destroy();

    winchan = new WinChanMock();

    var winMock = new WindowMock();
    docMock = winMock.document;

    pageHelpers.init({
      window: winMock
    });

    options = options || {};
    _.extend(options, {
      document: docMock,
      winchan: winchan
    });

    controller = bid.signIn.create();
    controller.start(options);
  }

  module("pages/js/signin", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/signin", {});
      createController();
    },
    teardown: function() {
      testHelpers.teardown();
      pageHelpers.reset();
      if(controller) controller.destroy();
    }
  });

  function testUserNotSignedIn(extraTests) {
    controller.signInSubmit(function() {
      testDocumentNotRedirected(docMock, "user not signed in");
      if (extraTests) extraTests();
      start();
    });
  }

  function testUserNotSignedUp(extraTests) {
    controller.signUpSubmit(function() {
      testDocumentNotRedirected(docMock, "user not signed up");
      if (extraTests) extraTests();
      start();
    });
  }

  asyncTest("start with no email stored - nothing fancy", function() {
    createController({
      ready: function() {
        testDocumentNotRedirected(docMock, "user not signed in");
        start();
      }
    });
  });

  asyncTest("start with unknown secondary email stored - show double password", function() {
    xhr.useResult("unknown_secondary");
    pageHelpers.setStoredEmail("unregistered@testuser.com");
    createController({
      ready: function() {
        testHasClass("body", "unknown_secondary", "unknown_secondary class added to body");
        testDocumentNotRedirected(docMock);
        equal($("#title").html(), "Sign Up", "title correctly set");
        start();
      }
    });
  });

  asyncTest("start with known secondary email stored - show password", function() {
    xhr.useResult("known_secondary");
    pageHelpers.setStoredEmail("registered@testuser.com");
    createController({
      ready: function() {
        testHasClass("body", "known_secondary", "known_secondary class added to body");
        testDocumentNotRedirected(docMock);
        equal($("#title").html(), "Sign In", "title correctly set");

        // Make sure a tab keyup into the email field does not close the
        // password field. This simulates a keyup happening into the email
        // field, which if the user had not yet typed anything into the email
        // field but the field was filled in because of the stored email, the
        // password field would be hidden. See issue #2353
        var e = jQuery.Event("keyup", { keyCode: 9 });
        $("#email").trigger(e);
        testHasClass("body", "known_secondary", "known_secondary class still on body");

        start();
      }
    });
  });

  asyncTest("start with known primary email stored - show verify primary", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
    pageHelpers.setStoredEmail("registered@testuser.com");

    createController({
      ready: function() {
        testHasClass("body", "primary", "primary class added to body");

        testDocumentNotRedirected(docMock);
        start();
      }
    });
  });

  asyncTest("emailSubmit with invalid email - show tooltip", function() {
    controller.emailSubmit(function() {
      testHelpers.testTooltipVisible();
      start();
    });
  });

  asyncTest("address with XHR error - show error screen", function() {
    xhr.useResult("ajaxError");
    $("#email").val("unregistered@testuser.com");

    controller.emailSubmit(function() {
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("unknown_secondary: emailSubmit - unknown_secondary added to body", function() {
    xhr.useResult("unknown_secondary");
    $("#email").val("unregistered@testuser.com");

    controller.emailSubmit(function() {
      testHasClass("body", "unknown_secondary", "unknown_secondary class added to body");
      equal(controller.submit, controller.signUpSubmit, "submit has changed to signUpSubmit");
      start();
    });
  });

  asyncTest("known_secondary: emailSubmit - known_secondary added to body", function() {
    xhr.useResult("known_secondary");
    $("#email").val("registered@testuser.com");

    controller.emailSubmit(function() {
      testHasClass("body", "known_secondary", "known_secondary class added to body");
      equal(controller.submit, controller.signInSubmit, "submit has changed to signInSubmit");
      start();
    });
  });

  asyncTest("primary, authenticated with IdP: emailSubmit - user immediately signed in", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);
    $("#email").val("registered@testuser.com");

    controller.emailSubmit(function() {
      network.checkAuth(function(status) {
        equal(status, "assertion", "user is authenticated with an assertion");
        equal(docMock.location, "/", "user signed in, page redirected");
        start();
      }, testHelpers.unexpectedFailure);
    });
  });

  asyncTest("primary, not authenticated with IdP: emailSubmit - sign in to IdP shown", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
    $("#email").val("registered@testuser.com");

    controller.emailSubmit(function() {
      testHasClass("body", "primary", "primary class added to body");
      equal(controller.submit, controller.authWithPrimary, "submit updated to authWithPrimary");
      start();
    });
  });

  asyncTest("signInSubmit with valid email and password", function() {
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    controller.signInSubmit(function() {
      equal(docMock.location, "/", "user signed in, page redirected");
      start();
    });
  });

  asyncTest("signInSubmit with valid email with leading/trailing whitespace and password", function() {
    $("#email").val("  registered@testuser.com  ");
    $("#password").val("password");

    controller.signInSubmit(function() {
      equal(docMock.location, "/", "user signed in, page redirected");
      start();
    });
  });

  asyncTest("signInSubmit with missing email", function() {
    $("#email").val("");
    $("#password").val("password");

    testUserNotSignedIn();
  });

  asyncTest("signInSubmit with missing password", function() {
    $("#email").val("registered@testuser.com");
    $("#password").val("");

    testUserNotSignedIn();
  });


  asyncTest("signInSubmit with bad username/password", function() {
    xhr.useResult("invalid");
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    testUserNotSignedIn();
  });

  asyncTest("signInSubmit with XHR error", function() {
    xhr.useResult("ajaxError");
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    testUserNotSignedIn(testHelpers.testErrorVisible);
  });


  asyncTest("signUpSubmit with valid email and password", function() {
    $("#email").val("registered@testuser.com");
    $("#password, #vpassword").val("password");

    controller.signUpSubmit(function(status) {
      ok(status, "signUpSubmit success");
      start();
    });
  });

  asyncTest("signUpSubmit with valid email with leading/trailing whitespace and password", function() {
    $("#email").val("  registered@testuser.com  ");
    $("#password, #vpassword").val("password");

    controller.signUpSubmit(function(email) {
      equal(email, "registered@testuser.com", "signUpSubmit success with trimmed email");
      start();
    });
  });

  asyncTest("signUpSubmit with missing email", function() {
    $("#email").val("");
    $("#password, #vpassword").val("password");

    testUserNotSignedUp();
  });

  asyncTest("signUpSubmit with missing password", function() {
    $("#email").val("registered@testuser.com");
    $("#password").val("");
    $("#vpassword").val("password");

    testUserNotSignedUp();
  });

  asyncTest("signUpSubmit with missing vpassword", function() {
    $("#email").val("registered@testuser.com");
    $("#password").val("password");
    $("#vpassword").val("");

    testUserNotSignedUp();
  });

  asyncTest("signUpSubmit with too short of a password", function() {
    $("#email").val("registered@testuser.com");
    var pass = testHelpers.generateString(bid.PASSWORD_MIN_LENGTH - 1);
    $("#password").val(pass);
    $("#vpassword").val(pass);

    testUserNotSignedUp();
  });

  asyncTest("signUpSubmit with too long of a password", function() {
    $("#email").val("registered@testuser.com");
    var pass = testHelpers.generateString(bid.PASSWORD_MAX_LENGTH + 1);
    $("#password").val(pass);
    $("#vpassword").val(pass);

    testUserNotSignedUp();
  });

  asyncTest("signUpSubmit with bad username/password", function() {
    xhr.useResult("invalid");
    $("#email").val("registered@testuser.com");
    $("#password, #vpassword").val("password");

    testUserNotSignedUp();
  });

  asyncTest("signUpSubmit with throttling", function() {
    $("#email").val("unregistered@testuser.com");
    $("#password, #vpassword").val("password");

    xhr.useResult("throttle");
    controller.signUpSubmit(function(userStaged) {
      equal(userStaged, false, "email throttling took effect, user not staged");
      start();
    });
  });

  asyncTest("signUpSubmit with XHR error", function() {
    xhr.useResult("ajaxError");
    $("#email").val("registered@testuser.com");
    $("#password,#vpassword").val("password");

    testUserNotSignedUp(testHelpers.testErrorVisible);
  });



  asyncTest("authWithPrimary opens winchan", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    controller.emailSubmit(function(status) {
      controller.authWithPrimary(function() {
        ok(winchan.oncomplete, "winchan set up");
        start();
      });
    });
  });

  asyncTest("primaryAuthComplete logs user in", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    controller.emailSubmit(function() {
      controller.authWithPrimary(function() {
        provisioning.setStatus(provisioning.AUTHENTICATED);
        // Before primaryAuthComplete is called, we reset the user caches to
        // force re-fetching of what could have been stale user data.
        user.resetCaches();

        controller.primaryAuthComplete(null, "yar", function() {
          network.checkAuth(function(status) {
            equal(status, "assertion", "user is authenticated with an assertion");
            equal(docMock.location, "/", "user signed in, page redirected");
            start();
          }, testHelpers.unexpectedFailure);
        });
      });
    });
  });


}());
