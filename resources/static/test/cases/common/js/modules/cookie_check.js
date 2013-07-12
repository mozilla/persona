/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      network = bid.Network,
      testHelpers = bid.TestHelpers,
      controller;

  function createController(config) {
    controller = BrowserID.Modules.CookieCheck.create();
    controller.start(config);
  }

  module("common/js/modules/cookie_check", {
    setup: function() {
      testHelpers.setup();
    },

    teardown: function() {
      testHelpers.teardown();

      controller.destroy();
    }
  });

  asyncTest("create controller cookies disabled - ready returns with false status", function() {
    network.cookiesEnabledOverride = false;

    createController({
      ready: function(status) {
        equal(status, false, "cookies are disabled, false status");
        testHelpers.testErrorVisible();
        // make sure the message is not escaped. If it is escaped, the anchor
        // will not be found. see issue #2979
        ok($("#enable_cookies").length);
        start();
      }
    });
  });

  asyncTest("create controller with cookies enabled - ready returns with true status", function() {
    network.cookiesEnabledOverride = true;

    createController({
      ready: function(status) {
        equal(status, true, "cookies are enabled, true status");
        start();
      }
    });
  });

}());

