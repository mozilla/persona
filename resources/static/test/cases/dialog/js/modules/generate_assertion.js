/*jshint browser: true, forin: true, laxbreak: true */
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
      mediator = bid.Mediator,
      user = bid.User;

  function createController(config, complete) {
    config = config || {};
    config.ready = complete;

    controller = BrowserID.Modules.GenerateAssertion.create();
    controller.start(config);
  }

  module("dialog/js/modules/email_chosen", {
    setup: function() {
      testHelpers.setup();
    },

    teardown: function() {
      if(controller) {
        controller.destroy();
      }
      testHelpers.teardown();
    }
  });

  asyncTest("start with email, expect an assertion to be generated", function() {
    user.syncEmailKeypair("testuser@testuser.com", function() {
      createController( { email: "testuser@testuser.com" }, function(assertion) {
        ok(assertion, "assertion generated");
        start();
      });
    });
  });

}());

