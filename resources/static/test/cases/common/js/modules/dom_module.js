/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller, el,
      bid = BrowserID,
      mediator = bid.Mediator;

  function createController(options) {
    controller = bid.Modules.DOMModule.create(options);
    controller.start();
  }

  module("common/js/modules/dom_module", {
    setup: function() {
      bid.TestHelpers.setup();
    },

    teardown: function() {
      controller.destroy();
      bid.TestHelpers.teardown();
    }
  });

  asyncTest("bind DOM Events", function() {
    createController();

   controller.bind("body", "click", function(event) {
      event.preventDefault();

      strictEqual(this, controller, "context is correct");
      start();
   });

   $("body").trigger("click");
  });

  asyncTest("click - bind a click handler, handler does not get event", function() {
    createController();

    controller.click("body", function(event) {
      equal(typeof event, "undefined", "event is undefined");
      strictEqual(this, controller, "context is correct");
      start();
    });

    $("body").trigger("click");
  });

  asyncTest("unbindAll removes all listeners", function() {
    createController();
    var listenerCalled = false;

    controller.bind("body", "click", function(event) {
      event.preventDefault();

      listenerCalled = true;
    });

    controller.unbindAll();

    $("body").trigger("click");

    setTimeout(function() {
      equal(listenerCalled, false, "all events are unbound, listener should not be called");
      start();
    }, 1);
  });

}());

