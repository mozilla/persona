/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      mediator = bid.Mediator,
      testHelpers = bid.TestHelpers;

  function createController(options) {
    controller = bid.Modules.Module.create(options);
    controller.start();
  }

  module("common/js/modules/module", {
    setup: function() {
      bid.TestHelpers.setup();
    },

    teardown: function() {
      controller.destroy();
      bid.TestHelpers.teardown();
    }
  });

  test("subscribe/stop - listens to messages from the mediator. All bindings are removed whenever stop is called", function() {
    createController();
    var count = 0;
    controller.subscribe("message", function(msg, data) {
      strictEqual(this, controller, "context set to the controller");
      equal(msg, "message", "correct message passed");
      equal(data.field, 1, "correct data passed");
      count++;
    });

    mediator.publish("message", { field: 1 });
    equal(1, count, "subscriber called");

    // Subscriptions should be removed on stop
    controller.stop();
    mediator.publish("after_stop");
    equal(1, count, "subscriptions are removed on stop");
  });

  test("subscribeAll - listen for ALL messages", function() {
    createController();
    var count = 0;
    controller.subscribeAll(function(msg, data) {
      count++;
    });

    var messages = ["message1", "message2", "message3"];
    _.each(messages, mediator.publish);

    equal(count, messages.length, "subscriber called for all messages");

    // Subscriptions should be removed on stop
    controller.stop();
    mediator.publish("after_stop");
    equal(count, messages.length, "subscriptions are removed on stop");
  });

  asyncTest("publish - publish messages to the mediator", function() {
    createController();

    mediator.subscribe("message", function(msg, data) {
      equal(msg, "message", "message is correct");
      equal(data.field, 1, "data passed correctly");
      start();
    });

    controller.publish("message", {
      field: 1
    });
  });

  test("checkRequired", function() {
    createController();

    var error;
    try {
      controller.checkRequired({}, "requiredField");
    }
    catch(e) {
      error = e;
    }

    equal(error.message, "missing config option: requiredField");
  });

  test("importFrom", function() {
    createController();

    controller.importFrom({ field: "value" }, "field", "missing_field");

    equal(controller.field, "value");
    testHelpers.testUndefined(controller.missing_field);
  });

}());

