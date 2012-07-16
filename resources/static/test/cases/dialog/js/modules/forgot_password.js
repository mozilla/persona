/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      el = $("body"),
      bid = BrowserID,
      register = bid.TestHelpers.register;

  function createController(options) {
    controller = bid.Modules.ForgotPassword.create();
    controller.start(options);
  }

  module("dialog/js/modules/forgotpassword_controller", {
    setup: function() {
      $("#email").val("");
      bid.TestHelpers.setup();
      createController({ email: "registered@testuser.com" });
    },

    teardown: function() {
      if (controller) {
        try {
          controller.destroy();
          controller = null;
        } catch(e) {
          // may already be destroyed from close inside of the controller.
        }
      }
      bid.TestHelpers.setup();
    }
  });

  test("email address prefills address field", function() {
    equal($("#email").val(), "registered@testuser.com", "email prefilled");
  });

  asyncTest("resetPassword raises 'password_reset' with email address", function() {
    register("password_reset", function(msg, info) {
      equal(info.email, "registered@testuser.com", "password_reset raised with correct email address");
      start();
    });

    controller.resetPassword();
  });

  asyncTest("cancelResetPassword raises 'cancel_forgot_password'", function() {
    register("cancel_state", function(msg, info) {
      ok(true, "cancel_state triggered");
      start();
    });

    controller.cancelResetPassword();
  });
}());

