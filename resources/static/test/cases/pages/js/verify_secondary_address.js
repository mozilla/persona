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
      pageHelpers = bid.PageHelpers,
      testHelpers = bid.TestHelpers,
      testHasClass = testHelpers.testHasClass,
      testVisible = testHelpers.testVisible,
      testNotVisible = testHelpers.testNotVisible,
      testElementTextEquals = testHelpers.testElementTextEquals,
      testDocumentRedirected = testHelpers.testDocumentRedirected,
      validToken = true,
      controller,
      config = {
        token: "token",
        verifyFunction: "verifyEmail"
      },
      doc;

  module("pages/js/verify_secondary_address", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/confirm", {});
      $(document.body).append($('<div id=redirectTimeout>'));
      $(".siteinfo,.password_entry").hide();
    },
    teardown: function() {
      $('#redirectTimeout').remove();
      testHelpers.teardown();
    }
  });

  function createController(options, callback) {
    controller = BrowserID.verifySecondaryAddress.create();
    // defaults, but options can override
    options = _.extend({
      document: new WindowMock().document,
      redirectTimeout: 0,
      ready: callback
    }, options || {});
    doc = options.document;
    controller.start(options);
  }

  function testInvalidPassword(password) {
    $("#password").val(password);

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

    equal(error.message, "missing config option: token", "correct error thrown");
  });

  asyncTest("valid token, no password necessary - verify user and show site info, user is redirected to saved URL", function() {
    var returnTo = "https://test.domain/path";
    storage.setReturnTo(returnTo);

    createController(config, function() {
      testHasClass("body", "complete");
      testElementTextEquals(".website", returnTo, "origin is set to redirect to login.persona.org");
      testDocumentRedirected(doc, returnTo, "redirection occurred to correct URL");
      equal(storage.site.get("https://test.domain", "logged_in"), "testuser@testuser.com", "logged in status set");
      start();
    });
  });

  asyncTest("valid token, no password necessary, no saved site info - verify user, user is redirected to login.persona.org", function() {
    var returnTo = "https://login.persona.org/";

    createController(config, function() {
      testEmail();
      testNotVisible(".siteinfo", "siteinfo is not visible without having it");
      testElementTextEquals(".website", returnTo, "origin is set to redirect to login.persona.org");
      testDocumentRedirected(doc, returnTo, "redirection occurred to correct URL");
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

  testHelpers.testInvalidAuthenticationPassword(testInvalidPassword);

  asyncTest("incorrect password does not authenticate", function() {
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

  asyncTest("submit good password and token authenticates", function() {
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

  asyncTest("good password & bad token shows an error message", function() {
    $("#password").val("password");

    xhr.useResult("invalid");
    createController(config, function() {
      testCannotConfirm();
      start();
    });
  });

  asyncTest("redirect: message shows with correct timeout", function() {
    var returnTo = 'http://test.domain/path';
    storage.setReturnTo(returnTo);
    var timeout = 2;

    //mock out helper so we can check progress of redirectTimeout el
    var replaceFormWithNotice = pageHelpers.replaceFormWithNotice;
    pageHelpers.replaceFormWithNotice = function(selector, cb) {
      // mock out 2s network response
      setTimeout(function mockedNetwork() {
        replaceFormWithNotice.call(this, selector, function intercepted() {
          equal(parseInt($('#redirectTimeout').html(), 10), timeout,
            'timeout should not have started countdown yet');

          //at the end, finish with cb
          cb && cb();
        });
      }, (timeout - 1) * 1000);
    };

    var options = _.extend({ redirectTimeout: timeout * 1000 }, config);
    createController(options, function() {
      // teardown
      pageHelpers.replaceFormWithNotice = replaceFormWithNotice;
      start();
    });
  });

}());
