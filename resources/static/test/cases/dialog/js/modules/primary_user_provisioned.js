/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      storage = bid.Storage,
      user = bid.User,
      network = bid.Network,
      testHelpers = bid.TestHelpers,
      register = testHelpers.register,
      xhr = bid.Mocks.xhr,
      mediator = bid.Mediator;

  module("dialog/js/modules/primary_user_provisioned", {
    setup: function() {
      testHelpers.setup();
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


  function createController(config) {
    controller = bid.Modules.PrimaryUserProvisioned.create();
    config = config || {};
    config.complete_delay = 1;
    controller.start(config);
  }

  test("starting the controller without email throws assertion", function() {
    var error;

    try {
      createController({});
    }
    catch(e) {
      error = e;
    }

    equal(error, "missing config option: email", "correct error message printed");
  });

  test("starting the controller without assertion throws assertion", function() {
    var error;

    try {
      createController({email: "unregistered@testuser.com"});
    }
    catch(e) {
      error = e;
    }

    equal(error, "missing config option: assertion", "correct error message printed");
  });

  asyncTest("start controller with `add: false` and XHR error displays error screen", function() {
    xhr.useResult("ajaxError");

    createController({
      email: "unregistered@testuser.com",
      assertion: "test_assertion",
      add: false,
      ready: function(status) {
        equal(status, false, "correct status for XHR error");
        testHelpers.testErrorVisible();
        start();
      }
    });
  });

  asyncTest("start controller with `add: false` authenticates user", function() {
    register("primary_user_ready", function(msg, info) {
      network.checkAuth(function(status) {
        equal(status, "assertion", "status is correct");
        start();
      });
    });

    xhr.useResult("valid");
    createController({
      email: "unregistered@testuser.com",
      add: false,
      assertion: "test_assertion",
      ready: function(status) {
        equal(true, status, "valid status");
      }
    });
  });

  asyncTest("start controller with `add: true` and XHR error displays error screen", function() {
    xhr.useResult("ajaxError");

    createController({
      email: "unregistered@testuser.com",
      assertion: "test_assertion",
      add: true,
      ready: function(status) {
        equal(status, false, "correct status for XHR error");
        testHelpers.testErrorVisible();
        start();
      }
    });
  });

  asyncTest("start controller with `add: true` adds email to user's list", function() {
    register("primary_user_ready", function(msg, info) {
      start();
    });

    xhr.useResult("valid");
    createController({
      email: "unregistered@testuser.com",
      add: true,
      assertion: "test_assertion",
      ready: function(status) {
        equal(true, status, "valid status");
      }
    });
  });

}());

