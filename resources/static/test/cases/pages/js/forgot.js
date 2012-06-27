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

  function testEmailNotSent(config) {
    config = config || {};
    bid.forgot.submit(function() {
      equal($(".emailsent").is(":visible"), false, "email not sent");
      if(config.checkTooltip !== false) testHelpers.testTooltipVisible();
      if (config.ready) config.ready();
      else start();
    });
  }

  asyncTest("requestPasswordReset with invalid email", function() {
    $("#email").val("invalid");
    $("#password,#vpassword").val("password");

    xhr.useResult("invalid");

    testEmailNotSent();
  });

  asyncTest("requestPasswordReset with known email, happy case - show email sent notice", function() {
    $("#email").val("registered@testuser.com");
    $("#password,#vpassword").val("password");

    bid.forgot.submit(function() {
      ok($(".emailsent").is(":visible"), "email sent successfully");
      start();
    });
  });

  asyncTest("requestPasswordReset with known email with leading/trailing whitespace - show email sent notice", function() {
    $("#email").val("   registered@testuser.com  ");
    $("#password,#vpassword").val("password");

    bid.forgot.submit(function() {
      ok($(".emailsent").is(":visible"), "email sent successfully");
      start();
    });
  });

  asyncTest("requestPasswordReset with missing password", function() {
    $("#email").val("unregistered@testuser.com");
    $("#vpassword").val("password");

    testEmailNotSent();
  });

  asyncTest("requestPasswordReset with too short of a password", function() {
    $("#email").val("unregistered@testuser.com");
    $("#password,#vpassword").val("fail");

    testEmailNotSent();
  });

  asyncTest("requestPasswordReset with too long of a password", function() {
    $("#email").val("unregistered@testuser.com");
    $("#password,#vpassword").val(testHelpers.generateString(81));

    testEmailNotSent();
  });

  asyncTest("requestPasswordReset with missing vpassword", function() {
    $("#email").val("unregistered@testuser.com");
    $("#password").val("password");

    testEmailNotSent();
  });

  asyncTest("requestPasswordReset with unknown email", function() {
    $("#email").val("unregistered@testuser.com");
    $("#password,#vpassword").val("password");

    testEmailNotSent();
  });

  asyncTest("requestPasswordReset with throttling", function() {
    $("#email").val("registered@testuser.com");
    $("#password,#vpassword").val("password");

    xhr.useResult("throttle");
    testEmailNotSent();
  });

  asyncTest("requestPasswordReset with XHR Error", function() {
    $("#email").val("testuser@testuser.com");
    $("#password,#vpassword").val("password");

    xhr.useResult("ajaxError");
    testEmailNotSent({
      ready: function() {
        testHelpers.testErrorVisible();
        start();
      },
      checkTooltip: false
    });
  });

}());
