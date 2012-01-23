/*jshint browsers:true, forin: true, laxbreak: true */
/*global asyncTest: true, test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      controller,
      el,
      testHelpers = bid.TestHelpers,
      WindowMock = bid.Mocks.WindowMock,
      win,
      mediator = bid.Mediator;

  function createController(config) {
    controller = BrowserID.Modules.VerifyPrimaryUser.create();
    controller.start(config);
  }

  module("controllers/verify_primary_user", {
    setup: function() {
      testHelpers.setup();
      win = new WindowMock();
    },

    teardown: function() {
      if(controller) {
        controller.destroy();
      }
      testHelpers.teardown();
    }
  });

  asyncTest("submit with `add: false` option opens a new tab with CREATE_EMAIL URL", function() {
    var messageTriggered = false;
    createController({
      window: win,
      add: false,
      email: "unregistered@testuser.com",
      auth_url: "http://testuser.com/sign_in"
    });
    mediator.subscribe("primary_user_authenticating", function() {
      messageTriggered = true;
    });

    // Also checking to make sure the NATIVE is stripped out.
    win.document.location.href = "sign_in";
    win.document.location.hash = "#NATIVE";

    controller.submit(function() {
      equal(win.document.location, "http://testuser.com/sign_in?email=unregistered%40testuser.com&return_to=sign_in%23CREATE_EMAIL%3Dunregistered%40testuser.com");
      equal(messageTriggered, true, "primary_user_authenticating triggered");
      start();
    });
  });

  asyncTest("submit with `add: true` option opens a new tab with ADD_EMAIL URL", function() {
    createController({
      window: win,
      add: true,
      email: "unregistered@testuser.com",
      auth_url: "http://testuser.com/sign_in"
    });

    // Also checking to make sure the NATIVE is stripped out.
    win.document.location.href = "sign_in";
    win.document.location.hash = "#NATIVE";

    controller.submit(function() {
      equal(win.document.location, "http://testuser.com/sign_in?email=unregistered%40testuser.com&return_to=sign_in%23ADD_EMAIL%3Dunregistered%40testuser.com");
      start();
    });
  });

  asyncTest("cancel triggers the cancel_state", function() {
    createController({
      window: win,
      add: true,
      email: "unregistered@testuser.com",
      auth_url: "http://testuser.com/sign_in"
    });

    testHelpers.register("cancel_state");

    controller.cancel(function() {
      equal(testHelpers.isTriggered("cancel_state"), true, "cancel_state is triggered");
      start();
    });
  });

}());

