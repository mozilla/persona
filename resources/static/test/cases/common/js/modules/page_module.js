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

