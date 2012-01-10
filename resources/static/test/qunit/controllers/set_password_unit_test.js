/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      storage = bid.Storage,
      testHelpers = bid.TestHelpers,
      xhr = bid.Mocks.xhr,
      register = bid.TestHelpers.register;

  module("controllers/set_password", {
    setup: function() {
      testHelpers.setup();
      createController();
      $("#password").val("");
      $("#vpassword").val("");
    },

    teardown: function() {
      if (controller) {
        try {
          controller.destroy();
          controller = null;
        } catch(e) {
          // could already be destroyed from the close
        }
      }
      testHelpers.setup();
    }
  });


  function createController(options) {
    controller = bid.Modules.SetPassword.create();
    controller.start(options);
  }

  function testInvalidInput() {
    controller.setPassword(function(status) {
      equal(false, status, "status is false");
      testHelpers.testTooltipVisible();
      start();
    });
  }

  test("create displays the correct template", function() {
    equal($("#set_password").length, 1, "the correct template is displayed");
  });

  asyncTest("setPassword with no password", function() {
    $("#password").val("");
    $("#vpassword").val("password");
    testInvalidInput();
  });

  asyncTest("setPassword with no verification password", function() {
    $("#password").val("password");
    $("#vpassword").val("");
    testInvalidInput();
  });

  asyncTest("setPassword with too short of a password", function() {
    $("#password").val("pass");
    $("#vpassword").val("pass");
    testInvalidInput();
  });

  asyncTest("setPassword with mismatched passwords", function() {
    $("#password").val("passwords");
    $("#vpassword").val("password");
    testInvalidInput();
  });

  asyncTest("setPassword with XHR error", function() {
    $("#password").val("password");
    $("#vpassword").val("password");
    xhr.useResult("ajaxError");

    controller.setPassword(function(status) {
      equal(status, false, "correct status");
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("setPassword happy case", function() {
    $("#password").val("password");
    $("#vpassword").val("password");


    register("password_set", function(msg, info) {
      ok(true, msg + " message received");
      start();
    });

    controller.setPassword(function(status) {
      equal(status, true, "correct status");
    });
  });
}());

