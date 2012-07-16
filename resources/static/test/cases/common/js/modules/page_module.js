/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller, el,
      bodyTemplate = "test_template_with_input",
      waitTemplate = "wait",
      bid = BrowserID,
      mediator = bid.Mediator;

  function createController(options) {
    controller = bid.Modules.PageModule.create(options);
    controller.start();
  }

  module("common/js/modules/page_module", {
    setup: function() {
      el = $("#controller_head");
      bid.TestHelpers.setup();
    },

    teardown: function() {
      controller.destroy();
      bid.TestHelpers.teardown();
    }
  });

  test("page controller with no template causes no side effects", function() {
    createController();

    var html = el.find("#formWrap .contents").html();
    equal(html, "", "with no template specified, no text is loaded");

    html = el.find("#wait .contents").html();
    equal(html, "", "with no template specified, no text is loaded");
  });

  test("renderDialog with template with input element - render the correct dialog, focus first input element", function() {
    createController();

    controller.renderDialog("test_template_with_input", {
      title: "Test title",
      message: "Test message"
    });

    var html = el.find("#formWrap .contents").html();
    ok(html.length, "with template specified, form text is loaded");

    html = el.find("#wait .contents").html();
    equal(html, "", "with body template specified, wait text is not loaded");
  });

  test("renderError renders an error message", function() {
    createController();

    controller.renderError("wait", {
      title: "error title",
      message: "error message"
    });
    var html = el.find("#error .contents").html();
    ok(html.length, "with error template specified, error text is loaded");
  });

  test("renderDelay renders a delay", function() {
    createController();

    controller.renderDelay("wait", {
      title: "delay title",
      message: "delay message"
    });

    var html = el.find("#delay .contents").html();
    ok(html.length, "with delay template specified, delay text is loaded");
  });

  asyncTest("getErrorDialog gets a function that can be used to render an error message", function() {
    createController();

    // This is the medium level info.
    var func = controller.getErrorDialog({
      title: "medium level info error title",
      message: "medium level info error message"
    }, function() {
      ok(true, "onerror callback called when returned function is called");
      var html = el.find("#error .contents").html();
      // XXX underpowered test, we don't actually check the contents.
      ok(html.length, "when function is run, error text is loaded");
      start();
    });

    equal(typeof func, "function", "a function was returned from getErrorDialog");
    func();
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

  asyncTest("subscribe - listens to messages from the mediator", function() {
    createController();
    controller.subscribe("message", function(msg, data) {
      strictEqual(this, controller, "context set to the controller");
      equal(msg, "message", "correct message passed");
      equal(data.field, 1, "correct data passed");
      start();
    });

    mediator.publish("message", { field: 1 });
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

    equal(error, "missing config option: requiredField");
  });

  test("form is not submitted when 'submit_disabled' class is added to body", function() {
    createController();

    var submitCalled = false;
    controller.submit = function() {
      submitCalled = true;
    };

    $("body").addClass("submit_disabled");
    controller.onSubmit();

    equal(submitCalled, false, "submit was prevented from being called");


    $("body").removeClass("submit_disabled");
    controller.onSubmit();
    equal(submitCalled, true, "submit permitted to complete");
  });

}());

