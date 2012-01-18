/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
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
