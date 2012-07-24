/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
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
    winchan = new WinChanMock();
    docMock = new WindowMock().document;

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
      if(controller) controller.destroy();
    }
  });

  function testUserNotSignedIn(extraTests) {
    controller.passwordSubmit(function() {
      testDocumentNotRedirected(docMock, "user not signed in");
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

  asyncTest("start with unknown secondary email stored - redirect to /signup", function() {
    xhr.useResult("unknown_secondary");
    pageHelpers.setStoredEmail("unregistered@testuser.com");
    createController({
      ready: function() {
        testDocumentRedirected(docMock, "/signup", "user sent to /signup page");
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
        testHasClass("body", "verify_primary", "verify_primary class added to body");

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
    xhr.useResult("xhrError");
    $("#email").val("unregistered@testuser.com");

    controller.emailSubmit(function() {
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("unknown_secondary: emailSubmit - redirect to /signup", function() {
    xhr.useResult("unknown_secondary");
    $("#email").val("unregistered@testuser.com");

    controller.emailSubmit(function() {
      testDocumentRedirected(docMock, "/signup", "user redirected to /signup");
      start();
    });
  });

  asyncTest("known_secondary: emailSubmit - known_secondary added to body", function() {
    xhr.useResult("known_secondary");
    $("#email").val("registered@testuser.com");

    controller.emailSubmit(function() {
      testHasClass("body", "known_secondary", "known_secondary class added to body");
      equal(controller.submit, controller.passwordSubmit, "submit has changed to passwordSubmit");
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
      testHasClass("body", "verify_primary", "verify_primary class added to body");
      equal(controller.submit, controller.authWithPrimary, "submit updated to authWithPrimary");
      start();
    });
  });

  asyncTest("passwordSubmit with valid email and password", function() {
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    controller.passwordSubmit(function() {
      equal(docMock.location, "/", "user signed in, page redirected");
      start();
    });
  });

  asyncTest("passwordSubmit with valid email with leading/trailing whitespace and password", function() {
    $("#email").val("  registered@testuser.com  ");
    $("#password").val("password");

    controller.passwordSubmit(function() {
      equal(docMock.location, "/", "user signed in, page redirected");
      start();
    });
  });

  asyncTest("passwordSubmit with missing email", function() {
    $("#email").val("");
    $("#password").val("password");

    testUserNotSignedIn();
  });

  asyncTest("passwordSubmit with missing password", function() {
    $("#email").val("registered@testuser.com");
    $("#password").val("");

    testUserNotSignedIn();
  });


  asyncTest("passwordSubmit with bad username/password", function() {
    xhr.useResult("invalid");
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    testUserNotSignedIn();
  });

  asyncTest("passwordSubmit with XHR error", function() {
    xhr.useResult("ajaxError");
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    testUserNotSignedIn(testHelpers.testErrorVisible);
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
