/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      controller,
      testHelpers = bid.TestHelpers,
      storage = bid.Storage,
      mediator = bid.Mediator,
      xhr = bid.Mocks.xhr,
      user = bid.User;

  var ORIGIN = "http://testuser.com";

  function createController(config) {
    config = _.extend({
      origin: ORIGIN
    }, config);

    var rpInfo = bid.Models.RpInfo.create(config);
    config.rpInfo = rpInfo;

    controller = bid.Modules.GenerateAssertion.create();
    controller.start(config);
  }

  module("dialog/js/modules/generate_assertion", {
    setup: testHelpers.setup,

    teardown: function() {
      if (controller) {
        controller.destroy();
        controller = null;
      }
      testHelpers.teardown();
    }
  });

  asyncTest("start with valid email - " +
      "expect an assertion to be generated", function() {
    user.syncEmailKeypair("testuser@testuser.com", function() {
      var assertion;
      mediator.subscribe("assertion_generated", function(msg, info) {
        assertion = info.assertion;
      });

      createController({
        email: "testuser@testuser.com",
        ready: function() {
          ok(assertion, "assertion generated");
          start();
        }
      });
    });
  });

  asyncTest("generated assertion should set logged_in on site", function() {
    var EMAIL = "testuser@testuser.com";
    user.syncEmailKeypair(EMAIL, function() {
      var assertion;
      mediator.subscribe("assertion_generated", function(msg, info) {
        assertion = info.assertion;
      });

      createController({
        email: EMAIL,
        ready: function() {
          ok(assertion, "assertion generated");
          equal(storage.site.get(ORIGIN, "logged_in"), EMAIL);
          start();
        }
      });
    });
  });

  asyncTest("generated assertion when rpAPI is 'stateless' should set one_time on site", function() {
    var EMAIL = "testuser@testuser.com";
    user.syncEmailKeypair(EMAIL, function() {
      var assertion;
      mediator.subscribe("assertion_generated", function(msg, info) {
        assertion = info.assertion;
      });

      createController({
        email: EMAIL,
        rpAPI: "stateless",
        ready: function() {
          ok(assertion, "assertion generated");
          equal(storage.site.get(ORIGIN, "one_time"), EMAIL, "one_time bit set");
          equal(storage.site.get(ORIGIN, "logged_in"), undefined, "logged in not set");
          start();
        }
      });
    });
  });

  asyncTest("generated assertion when rpAPI is 'stateless' should remove `logged_in` on site", function() {
    var EMAIL = "testuser@testuser.com";
    user.syncEmailKeypair(EMAIL, function() {
      var assertion;
      mediator.subscribe("assertion_generated", function(msg, info) {
        assertion = info.assertion;
      });

      storage.site.set(ORIGIN, "logged_in", EMAIL);

      createController({
        email: EMAIL,
        rpAPI: "stateless",
        ready: function() {
          ok(assertion, "assertion generated");
          equal(storage.site.get(ORIGIN, "logged_in"), undefined, "logged in not set");
          start();
        }
      });
    });
  });
  asyncTest("start with error when generating assertion - " +
      "no assertion generated", function() {
    xhr.useResult("ajaxError");
    storage.addEmail("testuser@testuser.com", {});
    mediator.subscribe("assertion_generated", function(msg, info) {
      ok(false);
    });

    createController({
      email: "testuser@testuser.com",
      ready: function() {
        testHelpers.testErrorVisible();
        start();
      }
    });
  });

}());

