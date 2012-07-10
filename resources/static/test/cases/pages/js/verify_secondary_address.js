/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      storage = bid.Storage,
      xhr = bid.Mocks.xhr,
      WindowMock = bid.Mocks.WindowMock,
      dom = bid.DOM,
      testHelpers = bid.TestHelpers,
      testHasClass = testHelpers.testHasClass,
      testVisible = testHelpers.testVisible,
      validToken = true,
      controller,
      config = {
        token: "token",
        verifyFunction: "verifyEmail"
      },
      doc;

  module("pages/verify_secondary_address", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/confirm", {});
      $(".siteinfo,.password_entry").hide();
    },
    teardown: function() {
      testHelpers.teardown();
    }
  });

  function createController(options, callback) {
    controller = BrowserID.verifySecondaryAddress.create();
    options = options || {};
    options.document = doc = new WindowMock().document;
    options.redirectTimeout = 0;
    options.ready = callback;
    controller.start(options);
  }

  function expectTooltipVisible() {
    xhr.useResult("mustAuth");
    createController(config, function() {
      controller.submit(function() {
        testHelpers.testTooltipVisible();
        start();
      });
    });
  }

  function testEmail() {
    equal(dom.getInner("#email"), "testuser@testuser.com", "correct email shown");
  }

  function testCannotConfirm() {
    testHelpers.testErrorVisible();
  }

  test("start with missing token", function() {
    var error;
    try {
      createController({});
    } catch(e) {
      error = e;
    }

    equal(error, "missing config option: token", "correct error thrown");
  });

  asyncTest("valid token, no password necessary - verify user and show site info", function() {
    var returnTo = "https://test.domain/path";
    storage.setReturnTo(returnTo);

    createController(config, function() {
      testVisible("#congrats");
      testHasClass("body", "complete");
      equal($(".website").text(), returnTo, "website is updated");
      equal(doc.location.href, returnTo, "redirection occurred to correct URL");
      equal(storage.getLoggedIn("https://test.domain"), "testuser@testuser.com", "logged in status set");
      start();
    });
  });

  asyncTest("valid token, no password necessary, no saved site info - verify user but do not show site info", function() {
    createController(config, function() {
      testEmail();
      equal($(".siteinfo").is(":visible"), false, "siteinfo is not visible without having it");
      equal($(".siteinfo .website").text(), "", "origin is not updated");
      start();
    });
  });

  asyncTest("invalid token - show cannot confirm error", function() {
    xhr.useResult("invalid");

    createController(config, function() {
      testCannotConfirm();
      start();
    });
  });

  asyncTest("valid token with xhr error - show error screen", function() {
    xhr.useResult("ajaxError");
    createController(config, function() {
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("password: missing password", function() {
    $("#password").val();

    expectTooltipVisible();
  });

  asyncTest("password: good password", function() {
    $("#password").val("password");

    xhr.useResult("mustAuth");
    createController(config, function() {
      xhr.useResult("valid");
      testHasClass("body", "enter_password");
      controller.submit(function(status) {
        equal(status, true, "correct status");
        testHasClass("body", "complete");
        start();
      });
    });
  });

  asyncTest("password: bad password", function() {
    $("#password").val("password");

    xhr.useResult("mustAuth");
    createController(config, function() {
      xhr.useResult("badPassword");
      controller.submit(function(status) {
        equal(status, false, "correct status");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

  asyncTest("password: good password bad token", function() {
    $("#password").val("password");

    xhr.useResult("invalid");
    createController(config, function() {
      testCannotConfirm();
      start();
    });
  });

}());
