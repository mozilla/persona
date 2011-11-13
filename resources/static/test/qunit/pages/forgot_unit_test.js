/*jshint browsers:true, forin: true, laxbreak: true */
/*global steal: true, test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
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
steal.then("/pages/forgot", function() {
  "use strict";

  var bid = BrowserID,
      network = bid.Network,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      CHECK_DELAY = 500;

  module("pages/forgot", {
    setup: function() {
      network.setXHR(xhr);
      $(".error").removeClass("error");
      $("#error").stop().hide();
      xhr.useResult("valid");
      bid.forgot();
    },
    teardown: function() {
      network.setXHR($);
      $(".error").removeClass("error");
      $("#error").stop().hide();
      $(".website").text("");
      bid.forgot.reset();
    }
  });

  function testEmailNotSent(extraTests) {
    bid.forgot.submit();

    setTimeout(function() {
      equal($(".emailsent").is(":visible"), false, "email not sent");
      if (extraTests) extraTests();
      else start();
    }, CHECK_DELAY);

    stop();
  }

  test("requestPasswordReset with invalid email", function() {
    $("#email").val("invalid");

    xhr.useResult("invalid");

    testEmailNotSent();
  });

  test("requestPasswordReset with known email", function() {
    $("#email").val("registered@testuser.com");
    bid.forgot.submit();

    setTimeout(function() {
      ok($(".emailsent").is(":visible"), "email sent successfully");
      start();
    }, CHECK_DELAY);

    stop();
  });

  test("requestPasswordReset with unknown email", function() {
    $("#email").val("unregistered@testuser.com");

    testEmailNotSent();
  });

  test("requestPasswordReset with throttling", function() {
    xhr.useResult("throttle");

    $("#email").val("throttled@testuser.com");

    testEmailNotSent();
  });

  test("requestPasswordReset with XHR Error", function() {
    xhr.useResult("ajaxError");

    $("#email").val("testuser@testuser.com");

    testEmailNotSent(function() {
      equal($("#error").is(":visible"), true, "error is visible");
      start();
    });
  });

});
