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
      testErrorVisible = testHelpers.testErrorVisible,
      FORM_CONTENTS_SELECTOR = "#formWrap .contents",
      DELAY_CONTENTS_SELECTOR = "#delay .contents",
      DELAY_SHOWN_SELECTOR = "body.delay",
      ERROR_CONTENTS_SELECTOR = "#error .contents",
      ERROR_SHOWN_SELECTOR = "body.error",
      WAIT_CONTENTS_SELECTOR = "#wait .contents",
      WAIT_SHOWN_SELECTOR = "body.waiting",
      LOAD_CONTENTS_SELECTOR = "#load .contents",
      LOAD_SHOWN_SELECTOR = "body.loading",
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

  test("renderError publishes an error_screen event", function() {
    createController();
    mediator.subscribe("error_screen", function(msg, data) {
      equal(msg, 'error_screen', 'error_screen event triggered');
      equal(data.foo, 'bar', 'passed error object');
    });

    controller.renderError("error", { foo: 'bar' });
  });

  test("renderDelay renders a delay screen", function() {
    testRenderMessagingScreen("renderDelay", DELAY_CONTENTS_SELECTOR);
  });

  test("renderWait renders a wait screen", function() {
    testRenderMessagingScreen("renderWait", WAIT_CONTENTS_SELECTOR);
  });

  test("renderLoad renders a load screen", function() {
    testRenderMessagingScreen("renderLoad", LOAD_CONTENTS_SELECTOR);
  });

  test("hideWarningScreens hides the wait, error and delay screens", function() {
    createController();

    _.each(["renderWait", "renderError", "renderDelay", "renderLoad"], function(renderer) {
      controller[renderer]("wait", {
        title: renderer + " screen title",
        message: renderer + " screen message"
      });
    });

    controller.hideWarningScreens();
    _.each([WAIT_SHOWN_SELECTOR, DELAY_SHOWN_SELECTOR, ERROR_SHOWN_SELECTOR, LOAD_SHOWN_SELECTOR], function(selector) {
      testElementDoesNotExist(selector);
    });
  });

  asyncTest("getErrorDialog gets a function that can be used to render an error message", function() {
    createController();

    function escape(text) {
      var escaped = _.escape(text);
      // underscore escapes `/` whereas ejs does not
      return escaped.replace(/&#x2F;/g, '/');
    }

    // Because these can come from the IdP, they must be escaped when displayed
    // or else the IdP could XSS users
    var title = "<span>error title</span>";
    var message = "<span>extended error message</span>";

    // Call getErrorDialog with the "action" info.
    var func = controller.getErrorDialog({
      title: title
    }, function() {
      testErrorVisible();
      // make sure the text is escaped before IdPs start XSSing users.
      equal($("#errorTitle").html().trim(), escape(title));
      equal($("#errorMessage").html().trim(), escape(message));
      start();
    });

    equal(typeof func, "function");

    // action.message can be defined when calling getErrorDialog or when
    // calling the returned function.
    func({ action: { message: message }});
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

  asyncTest("cancelDialog publishes cancel message", function() {
    createController();
    testHelpers.expectedMessage("cancel");
    controller.cancelDialog(start);
  });

}());

