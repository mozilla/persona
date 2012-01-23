/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
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
      testHelpers = bid.TestHelpers,
      provisioning = bid.Mocks.Provisioning,
      winchan;

  module("pages/signup", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/signup", {});
      $(".emailsent").hide();
      $(".notification").hide()
      winchan = new WinChanMock();
      bid.signUp({
        winchan: winchan
      });
    },
    teardown: function() {
      testHelpers.teardown();
      bid.signUp.reset();
    }
  });

  function testNotRegistered(extraTests) {
    bid.signUp.submit(function(status) {
      strictEqual(status, false, "address was not registered");
      equal($(".emailsent").is(":visible"), false, "email not sent, notice not visible");

      if(extraTests) extraTests();
      start();
    });
  }

  asyncTest("signup with valid unregistered secondary email", function() {
    xhr.useResult("unknown_secondary");

    $("#email").val("unregistered@testuser.com");

    bid.signUp.submit(function() {
      equal($(".emailsent").is(":visible"), true, "email sent, notice visible");
      start();
    });
  });

  asyncTest("signup with valid unregistered email with leading/trailing whitespace", function() {
    xhr.useResult("unknown_secondary");

    $("#email").val(" unregistered@testuser.com ");

    bid.signUp.submit(function() {
      equal($(".emailsent").is(":visible"), true, "email sent, notice visible");
      start();
    });
  });

  asyncTest("signup with valid registered email", function() {
    xhr.useResult("known_secondary");
    $("#email").val("registered@testuser.com");

    testNotRegistered();
  });

  asyncTest("signup with invalid email address", function() {
    $("#email").val("invalid");

    testNotRegistered();
  });

  asyncTest("signup with throttling", function() {
    xhr.useResult("throttle");

    $("#email").val("unregistered@testuser.com");

    testNotRegistered();
  });

  asyncTest("signup with XHR error", function() {
    xhr.useResult("invalid");
    $("#email").val("unregistered@testuser.com");

    testNotRegistered(function() {
      testHelpers.testErrorVisible();
    });
  });

  asyncTest("signup with unregistered secondary email and cancel button pressed", function() {
    xhr.useResult("unknown_secondary");
    $("#email").val("unregistered@testuser.com");

    bid.signUp.submit(function() {
      bid.signUp.back(function() {
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

    bid.signUp.submit(function(status) {
      equal(status, false, "provisioning failure, status false");
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("signup with primary email address, user verified by primary - print success message", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");
    provisioning.setStatus(provisioning.AUTHENTICATED);

    bid.signUp.submit(function(status) {
      equal(status, true, "primary addition success - true status");
      equal($("#congrats:visible").length, 1, "success notification is visible");
      start();
    });
  });

  asyncTest("signup with primary email address, user must verify with primary", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    bid.signUp.submit(function(status) {
      equal($("#primary_verify:visible").length, 1, "success notification is visible");
      equal($("#primary_email").text(), "unregistered@testuser.com", "correct email shown");
      equal(status, false, "user must authenticate, some action needed.");
      start();
    });
  });

  asyncTest("authWithPrimary opens new tab", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    bid.signUp.submit(function(status) {
      bid.signUp.authWithPrimary(function() {
        ok(winchan.oncomplete, "winchan set up");
        start();
      });
    });
  });

  asyncTest("primaryAuthComplete with error, expect incorrect status", function() {
    bid.signUp.primaryAuthComplete("error", "", function(status) {
      equal(status, false, "correct status for could not complete");
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("primaryAuthComplete with successful authentication, expect correct status and congrats message", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    bid.signUp.submit(function(status) {
      bid.signUp.authWithPrimary(function() {
        // In real life the user would now be authenticated.
        provisioning.setStatus(provisioning.AUTHENTICATED);

        // Before primaryAuthComplete is called, we reset the user caches to
        // force re-fetching of what could have been stale user data.
        user.resetCaches();
        bid.signUp.primaryAuthComplete(null, "success", function(status) {
          equal(status, true, "correct status");
          equal($("#congrats:visible").length, 1, "success notification is visible");
          start();
        });
      });
    });
  });

}());
