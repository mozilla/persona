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
      testTooltipVisible = testHelpers.testTooltipVisible,
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
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("submit with good token", function() {
    bid.verifyEmailAddress("token", function() {
      equal($("#congrats").is(":visible"), true, "congrats is visible, we are complete");
      start();
    });
  });
}());
