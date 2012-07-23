/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      transport = bid.Mocks.xhr,
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

  asyncTest("create controller with XHR error during cookie check", function() {
    transport.useResult("contextAjaxError");

    createController({
      ready: function() {
        testHelpers.checkNetworkError();
        start();
      }
    });
  });

  asyncTest("create controller with cookies enabled - ready returns with true status", function() {
    transport.setContextInfo("cookies_enabled", true);

    createController({
      ready: function(status) {
        equal(status, true, "cookies are enabled, true status");
        start();
      }
    });
  });

}());

