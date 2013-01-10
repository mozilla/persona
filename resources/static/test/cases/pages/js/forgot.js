/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      network = bid.Network,
      user = bid.User,
      testHelpers = bid.TestHelpers,
      pageHelpers = bid.PageHelpers,
      xhr = bid.Mocks.xhr,
      WindowMock = bid.Mocks.WindowMock,
      controller,
      winMock,
      docMock;

  function createController(options) {
    options = options || {};


    winMock = new WindowMock();
    docMock = winMock.document;
    options.document = docMock;

    pageHelpers.init({
      window: winMock
    });

    controller = bid.forgot.create();
    controller.start(options);
  }

  module("pages/js/forgot", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/forgot", {});
      createController();
    },
    teardown: function() {
      testHelpers.teardown();
    }
  });

  function testEmailNotSent(config) {
    config = config || {};
    controller.submit(function() {
      equal($(".emailsent").is(":visible"), false, "email not sent");
      if(config.checkTooltip !== false) testHelpers.testTooltipVisible();
      if (config.ready) config.ready();
      else start();
    });
  }

  test("start with no stored email - redirect to /signin", function() {
    equal(docMock.location.href, "/signin", "page redirected to signin if no email stored");
  });

  asyncTest("start with stored primary email - redirect to /signin", function() {
    xhr.useResult("primary");
    pageHelpers.setStoredEmail("testuser@testuser.com");
    createController({
      ready: function() {
        equal(docMock.location.href, "/signin", "page redirected to signin if primary email stored");
        start();
      }
    });
  });

  asyncTest("start with stored unknown secondary email - redirect to /signin", function() {
    pageHelpers.setStoredEmail("unregistered@testuser.com");
    createController({
      ready: function() {
        equal(docMock.location.href, "/signin", "page redirected to signin if unknown secondary email stored");
        start();
      }
    });
  });

  test("start with stored known secondary email - no redirection", function() {
    pageHelpers.setStoredEmail("testuser@testuser.com");
    createController();
    equal(docMock.location.href, document.location.href, "no page redirection if known secondary is stored");
  });

  asyncTest("submit with invalid email", function() {
    $("#email").val("invalid");

    xhr.useResult("invalid");

    testEmailNotSent();
  });

  asyncTest("submit with known secondary email, happy case - show email sent notice", function() {
    $("#email").val("registered@testuser.com");

    controller.submit(function() {
      ok($(".emailsent").is(":visible"), "email sent successfully");
      start();
    });
  });

  asyncTest("submit with known secondary email with leading/trailing whitespace - show email sent notice", function() {
    $("#email").val("   registered@testuser.com  ");

    controller.submit(function() {
      ok($(".emailsent").is(":visible"), "email sent successfully");
      start();
    });
  });

  asyncTest("submit with unknown secondary email", function() {
    $("#email").val("unregistered@testuser.com");

    testEmailNotSent();
  });

  asyncTest("submit with throttling", function() {
    $("#email").val("registered@testuser.com");

    xhr.useResult("throttle");
    testEmailNotSent();
  });

  asyncTest("submit with XHR Error", function() {
    $("#email").val("testuser@testuser.com");

    xhr.useResult("ajaxError");
    testEmailNotSent({
      ready: function() {
        testHelpers.testErrorVisible();
        start();
      },
      checkTooltip: false
    });
  });

}());
