/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      network = bid.Network,
      storage = bid.Storage,
      xhr = bid.Mocks.xhr,
      testHelpers = bid.TestHelpers,
      validToken = true;

  module("pages/verify_email_address", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/verify_email_address", {});
    },
    teardown: function() {
      testHelpers.teardown();
    }
  });

  asyncTest("verifyEmailAddress with good token and site", function() {
    storage.setStagedOnBehalfOf("browserid.org");

    bid.verifyEmailAddress("token", function() {
      equal($("#email").val(), "testuser@testuser.com", "email set");
      ok($(".siteinfo").is(":visible"), "siteinfo is visible when we say what it is");
      equal($(".website:nth(0)").text(), "browserid.org", "origin is updated");
      start();
    });
  });

  asyncTest("verifyEmailAddress with good token and nosite", function() {
    $(".siteinfo").hide();
    storage.setStagedOnBehalfOf("");

    bid.verifyEmailAddress("token", function() {
      equal($("#email").val(), "testuser@testuser.com", "email set");
      equal($(".siteinfo").is(":visible"), false, "siteinfo is not visible without having it");
      equal($(".siteinfo .website").text(), "", "origin is not updated");
      start();
    });
  });

  asyncTest("verifyEmailAddress with bad token", function() {
    xhr.useResult("invalid");

    bid.verifyEmailAddress("token", function() {
      ok($("#cannotconfirm").is(":visible"), "cannot confirm box is visible");
      start();
    });
  });

  asyncTest("verifyEmailAddress with emailForVerficationToken XHR failure", function() {
    xhr.useResult("ajaxError");
    bid.verifyEmailAddress("token", function() {
      ok($("#error").is(":visible"), "cannot communicate box is visible");
      start();
    });
  });

  asyncTest("submit with good token, both passwords", function() {
    bid.verifyEmailAddress("token", function() {
      $("#password").val("password");
      $("#vpassword").val("password");

      bid.verifyEmailAddress.submit(function() {
        equal($("#congrats").is(":visible"), true, "congrats is visible, we are complete");
        start();
      });
    });
  });

  asyncTest("submit with good token, missing password", function() {
    bid.verifyEmailAddress("token", function() {
      $("#password").val("");
      $("#vpassword").val("password");

      bid.verifyEmailAddress.submit(function() {
        equal($("#congrats").is(":visible"), false, "congrats is not visible, missing password");
        start();
      });
    });
  });

  asyncTest("submit with good token, missing verification password", function() {
    bid.verifyEmailAddress("token");


    $("#password").val("password");
    $("#vpassword").val("");

    bid.verifyEmailAddress.submit(function() {
      equal($("#congrats").is(":visible"), false, "congrats is not visible, missing verification password");
      start();
    });

  });

  asyncTest("submit with good token, different passwords", function() {
    bid.verifyEmailAddress("token");

    $("#password").val("password");
    $("#vpassword").val("pass");

    bid.verifyEmailAddress.submit(function() {
      equal($("#congrats").is(":visible"), false, "congrats is not visible, different passwords");
      start();
    });

  });
}());
