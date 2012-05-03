/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      testHelpers = bid.TestHelpers,
      network = bid.Network,
      controller;

  module("shared/modules/interaction_data", {
    setup: testHelpers.setup,
    teardown: function() {
      testHelpers.teardown();

      controller.destroy();
    }
  });

  function createController(config) {
    config = _.extend({ forceSample: true }, config);
    controller = BrowserID.Modules.InteractionData.create();
    controller.start(config);
  }

  asyncTest("forceSample - data collection starts on context_info", function() {
    createController();

    network.withContext(function() {
      equal(controller.isSampling(), true, "sampling has started!");
      var data = controller.getData();

      testHelpers.testObjectHasOwnProperties(data, ["sample_rate", "timestamp", "lang", "user_agent"]);

      start();
    });
  });

  asyncTest("addEvent to stream, getEventStream", function() {
    createController();

    network.withContext(function() {
      controller.addEvent("something_special");

      var stream = controller.getStream(),
          lastItem = stream[stream.length - 1];

      equal(lastItem[0], "something_special", "name stored");
      equal(typeof lastItem[1], "number", "time stored");

      start();
    });
  });

  asyncTest("publish - publish any outstanding data", function() {

  });

}());
