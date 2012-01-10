/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller, el,
      bodyTemplate = "testBodyTemplate",
      waitTemplate = "wait",
      bid = BrowserID,
      mediator = bid.Mediator;

  function createController(options) {
    controller = bid.Modules.PageModule.create(options);
    controller.start();
  }

  module("controllers/page_controller", {
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

  test("page controller with body template renders in #formWrap .contents", function() {
    createController({
      bodyTemplate: bodyTemplate,
      bodyVars: {
        title: "Test title",
        message: "Test message"
      }
    });

    var html = el.find("#formWrap .contents").html();
    ok(html.length, "with template specified, form text is loaded");

/*

    var input = el.find("input").eq(0);
    ok(input.is(":focus"), "make sure the first input is focused");
*/
    html = el.find("#wait .contents").html();
    equal(html, "", "with body template specified, wait text is not loaded");
  });

  test("page controller with wait template renders in #wait .contents", function() {
    createController({
      waitTemplate: waitTemplate,
      waitVars: {
        title: "Test title",
        message: "Test message"
      }
    });

    var html = el.find("#formWrap .contents").html();
    equal(html, "", "with wait template specified, form is ignored");

    html = el.find("#wait .contents").html();
    ok(html.length, "with wait template specified, wait text is loaded");
  });

  test("page controller with error template renders in #error .contents", function() {
    createController({
      errorTemplate: waitTemplate,
      errorVars: {
        title: "Test title",
        message: "Test message"
      }
    });

    var html = el.find("#formWrap .contents").html();
    equal(html, "", "with error template specified, form is ignored");

    html = el.find("#error .contents").html();
    ok(html.length, "with error template specified, error text is loaded");
  });

  asyncTest("renderError renders an error message", function() {
    createController({
      waitTemplate: waitTemplate,
      waitVars: {
        title: "Test title",
        message: "Test message"
      }
    });

    controller.renderError("wait", {
      title: "error title",
      message: "error message"
    }, function() {
      var html = el.find("#error .contents").html();
      // XXX underpowered test, we don't actually check the contents.
      ok(html.length, "with error template specified, error text is loaded");
      start();
    });
  });

  asyncTest("renderError allows us to open expanded error info", function() {
    createController();

    controller.renderError("error", {
      action: {
        title: "expanded action info",
        message: "expanded message"
      }
    }, function() {
      var html = el.find("#error .contents").html();

      $("#moreInfo").hide();

      $("#openMoreInfo").click();

      setTimeout(function() {
        equal($("#showMoreInfo").is(":visible"), false, "button is not visible after clicking expanded info");
        equal($("#moreInfo").is(":visible"), true, "expanded error info is visible after clicking expanded info");
        start();
      }, 1);
    });
  });

  asyncTest("getErrorDialog gets a function that can be used to render an error message", function() {
    createController({
      waitTemplate: waitTemplate,
      waitVars: {
        title: "Test title",
        message: "Test message"
      }
    });

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

  asyncTest("publish", function() {
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

}());

