/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true, strictEqual */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      network = bid.Network,
      xhr = bid.Mocks.xhr,
      WinChanMock = bid.Mocks.WinChan,
      WindowMock = bid.Mocks.WindowMock,
      testHelpers = bid.TestHelpers,
      testDocumentRedirected = testHelpers.testDocumentRedirected,
      testDocumentNotRedirected = testHelpers.testDocumentNotRedirected,
      testHasClass = testHelpers.testHasClass,
      pageHelpers = bid.PageHelpers,
      provisioning = bid.Mocks.Provisioning,
      winchan,
      docMock,
      controller;

  function createController(options) {
    winchan = new WinChanMock();
    docMock = new WindowMock().document;

    options = options || {};
    _.extend(options, {
      document: docMock,
      winchan: winchan
    });

    controller = bid.signUp.create();
    controller.start(options);
  }

  module("pages/js/signup", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/signup", {});
      $(".emailsent").hide();
      $(".notification").hide();
      createController();
    },
    teardown: function() {
      testHelpers.teardown();
      controller.reset();
      controller.destroy();
    }
  });

  function testPasswordNotShown(extraTests) {
    controller.submit(function(status) {
      strictEqual(status, false, "address was not registered");
      equal($(".emailsent").is(":visible"), false, "email not sent, notice not visible");

      if(extraTests) extraTests();
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

  asyncTest("start with unknown secondary email stored - show password fields", function() {
    xhr.useResult("unknown_secondary");
    pageHelpers.setStoredEmail("unregistered@testuser.com");
    createController({
      ready: function() {
        start();
        testHasClass("body", "enter_password", "enter_password class added to body");
        testDocumentNotRedirected(docMock);
      }
    });
  });

  asyncTest("start with known secondary email stored - redirect to /signin", function() {
    xhr.useResult("known_secondary");
    pageHelpers.setStoredEmail("registered@testuser.com");
    createController({
      ready: function() {
        testDocumentRedirected(docMock, "/signin", "user sent to /signin page");
        start();
      }
    });
  });

  /*
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
*/
  asyncTest("signup with valid unregistered secondary email - show password", function() {
    $("#email").val("unregistered@testuser.com");

    controller.submit(function() {
      testHasClass("body", "enter_password", "new email, password section shown");

      start();
    });
  });


  asyncTest("submit with valid unregistered email with leading/trailing whitespace", function() {
    $("#email").val(" unregistered@testuser.com ");

    controller.submit(function() {
      testHasClass("body", "enter_password", "new email, password section shown");
      start();
    });
  });

  asyncTest("submit with valid registered email", function() {
    $("#email").val("registered@testuser.com");

    testPasswordNotShown();
  });

  asyncTest("submit with invalid email address", function() {
    $("#email").val("invalid");

    testPasswordNotShown();
  });

  asyncTest("submit with XHR error", function() {
    xhr.useResult("ajaxError");
    $("#email").val("unregistered@testuser.com");

    testPasswordNotShown(function() {
      testHelpers.testErrorVisible();
    });
  });


  asyncTest("passwordSubmit with throttling", function() {
    $("#email").val("unregistered@testuser.com");
    $("#password, #vpassword").val("password");

    xhr.useResult("throttle");
    controller.passwordSubmit(function(userStaged) {
      equal(userStaged, false, "email throttling took effect, user not staged");
      start();
    });
  });

  asyncTest("passwordSubmit happy case, check back button too", function() {
    $("#email").val("unregistered@testuser.com");
    $("#password, #vpassword").val("password");

    controller.passwordSubmit(function(userStaged) {
      equal(userStaged, true, "user has been staged");
      equal($(".emailsent").is(":visible"), true, "email sent, notice visible");

      // check back button
      controller.back(function() {
        equal($(".notification:visible").length, 0, "no notifications are visible - visible: " + $(".notification:visible").attr("id"));
        ok($(".forminputs:visible").length, "form inputs are again visible");
        equal($("#email").val(), "unregistered@testuser.com", "email address restored");
        start();
      });
    });
  });


  asyncTest("signup with primary email address, provisioning failure - expect error screen", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");
    provisioning.setFailure({
      code: "internal",
      msg: "doowap"
    });

    controller.submit(function(status) {
      equal(status, false, "provisioning failure, status false");
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("signup with primary email address, user verified by primary - print success message", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");
    provisioning.setStatus(provisioning.AUTHENTICATED);

    controller.submit(function(status) {
      equal(status, true, "primary addition success - true status");
      equal($("#congrats:visible").length, 1, "success notification is visible");
      start();
    });
  });

  asyncTest("signup with primary email address, user must verify with primary", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
    $("#email").val("unregistered@testuser.com");

    controller.submit(function(status) {
      equal($("#primary_verify:visible").length, 1, "success notification is visible");
      equal($("#primary_email").text(), "unregistered@testuser.com", "correct email shown");
      equal(status, false, "user must authenticate, some action needed.");
      start();
    });
  });

  asyncTest("authWithPrimary opens new tab", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    controller.submit(function(status) {
      controller.authWithPrimary(function() {
        ok(winchan.oncomplete, "winchan set up");
        start();
      });
    });
  });

  asyncTest("primaryAuthComplete with error, expect incorrect status", function() {
    controller.primaryAuthComplete("error", "", function(status) {
      equal(status, false, "correct status for could not complete");
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("primaryAuthComplete with successful authentication, expect correct status and congrats message", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    controller.submit(function(status) {
      controller.authWithPrimary(function() {
        // In real life the user would now be authenticated.
        provisioning.setStatus(provisioning.AUTHENTICATED);

        // Before primaryAuthComplete is called, we reset the user caches to
        // force re-fetching of what could have been stale user data.
        user.resetCaches();
        controller.primaryAuthComplete(null, "success", function(status) {
          equal(status, true, "correct status");
          equal($("#congrats:visible").length, 1, "success notification is visible");
          start();
        });
      });
    });
  });

}());
