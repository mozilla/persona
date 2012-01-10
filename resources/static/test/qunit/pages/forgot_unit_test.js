/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      network = bid.Network,
      user = bid.User,
      testHelpers = bid.TestHelpers,
      xhr = bid.Mocks.xhr;

  module("pages/forgot", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/forgot", {});
      bid.forgot();
    },
    teardown: function() {
      testHelpers.teardown();
      bid.forgot.reset();
    }
  });

  function testEmailNotSent(extraTests) {
    bid.forgot.submit(function() {
      equal($(".emailsent").is(":visible"), false, "email not sent");
      if (extraTests) extraTests();
      else start();
    });
  }

  asyncTest("requestPasswordReset with invalid email", function() {
    $("#email").val("invalid");

    xhr.useResult("invalid");

    testEmailNotSent();
  });

  asyncTest("requestPasswordReset with known email", function() {
    $("#email").val("registered@testuser.com");
    bid.forgot.submit(function() {
      ok($(".emailsent").is(":visible"), "email sent successfully");
      start();
    });
  });

  asyncTest("requestPasswordReset with known email with leading/trailing whitespace", function() {
    $("#email").val("   registered@testuser.com  ");
    bid.forgot.submit(function() {
      ok($(".emailsent").is(":visible"), "email sent successfully");
      start();
    });
  });

  asyncTest("requestPasswordReset with unknown email", function() {
    $("#email").val("unregistered@testuser.com");

    testEmailNotSent();
  });

  asyncTest("requestPasswordReset with throttling", function() {
    xhr.useResult("throttle");

    $("#email").val("throttled@testuser.com");

    testEmailNotSent();
  });

  asyncTest("requestPasswordReset with XHR Error", function() {
    xhr.useResult("ajaxError");

    $("#email").val("testuser@testuser.com");

    testEmailNotSent(function() {
      equal($("#error").is(":visible"), true, "error is visible");
      start();
    });
  });

}());
