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
        token: "token"
      },
      doc;

  module("pages/js/reset_password", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/reset_password", {});
      $(document.body).append($('<div id=redirectTimeout>'));
      $(".siteinfo,.password_entry").hide();
    },
    teardown: function() {
      $('#redirectTimeout').remove();
      testHelpers.teardown();
    }
  });

  function createController(options, callback) {
    controller = BrowserID.resetPassword.create();
    // defaults, but options can override
    options = _.extend({
      document: new WindowMock().document,
      redirectTimeout: 0,
      ready: callback
    }, options || {});
    doc = options.document;
    controller.start(options);
  }

  function testMustAuthCannotSubmit() {
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

  function testNeedsPasswordCannotSubmit() {
    xhr.useResult("needsPassword");

    createController(config, function() {
      controller.submit(function(status) {
        equal(status, false, "correct status");
        testHelpers.testTooltipVisible();
        start();
      });
    });
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

  // START TRANSITION CODE
  //
  // The transition code is for users who have started the reset password flow
  // under the old system where they set their password in the dialog. If this
  // is the case, the user does not have to enter their password now unless the
  // user started the transaction in a different browser.
  asyncTest("valid token, no password necessary - verify user and show site info, user is redirected to saved URL", function() {
    var returnTo = "https://test.domain/path";
    storage.setReturnTo(returnTo);

    createController(config, function() {
      testVisible("#congrats");
      testHasClass("body", "complete");
      testElementTextEquals(".website", returnTo, "origin is set to redirect to login.persona.org");
      testDocumentRedirected(doc, returnTo, "redirection occurred to correct URL");
      equal(storage.getLoggedIn("https://test.domain"), "testuser@testuser.com", "logged in status set");
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

  asyncTest("mustAuth: missing password", function() {
    $("#password").val();

    testMustAuthCannotSubmit();
  });

  asyncTest("mustAuth: good password", function() {
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

  asyncTest("mustAuth: bad password", function() {
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

  asyncTest("mustAuth: good password bad token", function() {
    $("#password").val("password");

    xhr.useResult("invalid");
    createController(config, function() {
      testCannotConfirm();
      start();
    });
  });


  // END TRANSITION CODE

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

  asyncTest("needsPassword - missing password", function() {
    $("#password").val();
    $("#vpassword").val("password");
    testNeedsPasswordCannotSubmit();
  });

  asyncTest("needsPassword - too short of a password", function() {
    $("#password,#vpassword").val(testHelpers.generateString(bid.PASSWORD_MIN_LENGTH - 1));
    testNeedsPasswordCannotSubmit();
  });

  asyncTest("needsPassword - too long of a password", function() {
    $("#password,#vpassword").val(testHelpers.generateString(bid.PASSWORD_MAX_LENGTH + 1));
    testNeedsPasswordCannotSubmit();
  });

  asyncTest("needsPassword - missing vpassword", function() {
    $("#password").val("password");
    $("#vpassword").val();
    testNeedsPasswordCannotSubmit();
  });

  asyncTest("needsPassword - password mismatch", function() {
    $("#password").val("password");
    $("#vpassword").val("password1");
    testNeedsPasswordCannotSubmit();
  });

  asyncTest("needsPassword: bad password", function() {
    $("#password,#vpassword").val("password");

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

  asyncTest("needsPassword - XHR error", function() {
    $("#password,#vpassword").val("password");
    xhr.useResult("needsPassword");

    createController(config, function() {
      xhr.useResult("ajaxError");
      controller.submit(function() {
        testHelpers.testErrorVisible();
        start();
      });
    });
  });


  asyncTest("needsPassword - happy case", function() {
    $("#password,#vpassword").val("password");
    xhr.useResult("needsPassword");

    createController(config, function() {
      xhr.useResult("valid");
      controller.submit(function(status) {
        equal(status, true, "correct status");
        testHasClass("body", "complete");
        start();
      });
    });
  });
}());
