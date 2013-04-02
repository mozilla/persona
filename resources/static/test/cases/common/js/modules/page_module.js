/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller, el,
      bodyTemplate = "test_template_with_input",
      waitTemplate = "wait",
      bid = BrowserID,
      testHelpers = bid.TestHelpers,
      testElementExists = testHelpers.testElementExists,
      testElementDoesNotExist = testHelpers.testElementDoesNotExist,
      testElementFocused = testHelpers.testElementFocused,
      FORM_CONTENTS_SELECTOR = "#formWrap .contents",
      DELAY_CONTENTS_SELECTOR = "#delay .contents",
      DELAY_SHOWN_SELECTOR = "body.delay",
      ERROR_CONTENTS_SELECTOR = "#error .contents",
      ERROR_SHOWN_SELECTOR = "body.error",
      WAIT_CONTENTS_SELECTOR = "#wait .contents",
      WAIT_SHOWN_SELECTOR = "body.waiting",
      BODY_SELECTOR = "body",
      FIRST_INPUT_SELECTOR = "input:visible:eq(0)",
      mediator = bid.Mediator;

  function testRenderMessagingScreen(renderer, contentEl) {
    createController();

    controller[renderer]("wait", {
      title: "screen title",
      message: "screen message"
    });
    var html = el.find(contentEl).html();
    ok(/screen message/.test(html), "message correctly rendered");
    ok(/screen title/.test(html), "title correctly rendered");
  }

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

    var html = el.find(FORM_CONTENTS_SELECTOR).html();
    equal(html, "", "with no template specified, no text is loaded");

    html = el.find(WAIT_CONTENTS_SELECTOR).html();
    equal(html, "", "with no template specified, no text is loaded");
  });

  test("renderForm with template with input element - render the correct dialog, focus first input element", function() {
    createController();

    controller.renderForm("test_template_with_input", {
      title: "Test title",
      message: "Test message"
    });

    var html = el.find(FORM_CONTENTS_SELECTOR).html();
    ok(html.length, "with template specified, form text is loaded");
    testElementFocused(FIRST_INPUT_SELECTOR);
  });

  test("renderError renders an error screen", function() {
    testRenderMessagingScreen("renderError", ERROR_CONTENTS_SELECTOR);
  });

  test("renderDelay renders a delay screen", function() {
    testRenderMessagingScreen("renderDelay", DELAY_CONTENTS_SELECTOR);
  });

  test("renderWait renders a wait screen", function() {
    testRenderMessagingScreen("renderWait", WAIT_CONTENTS_SELECTOR);
  });

  test("hideWarningScreens hides the wait, error and delay screens", function() {
    createController();

    _.each(["renderWait", "renderError", "renderDelay"], function(renderer) {
      controller[renderer]("wait", {
        title: renderer + " screen title",
        message: renderer + " screen message"
      });
    });

    controller.hideWarningScreens();
    _.each([WAIT_SHOWN_SELECTOR, DELAY_SHOWN_SELECTOR, ERROR_SHOWN_SELECTOR], function(selector) {
      testElementDoesNotExist(selector);
    });
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

    $(BODY_SELECTOR).addClass("submit_disabled");
    controller.onSubmit();

    equal(submitCalled, false, "submit was prevented from being called");


    $(BODY_SELECTOR).removeClass("submit_disabled");
    controller.onSubmit();
    equal(submitCalled, true, "submit permitted to complete");
  });

}());

