/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      storage = bid.Storage,
      xhr = bid.Mocks.xhr,
      dom = bid.DOM,
      testHelpers = bid.TestHelpers,
      testHasClass = testHelpers.testHasClass,
      validToken = true,
      controller,
      config = {
        token: "token",
        verifyFunction: "verifyEmail"
      };

  module("pages/verify_secondary_address", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/add_email_address", {});
      $(".siteinfo,.password_entry").hide();
    },
    teardown: function() {
      testHelpers.teardown();
    }
  });

  function createController(options, callback) {
    controller = BrowserID.verifySecondaryAddress.create();
    options = options || {};
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
    ok($("#cannotconfirm").is(":visible"), "cannot confirm box is visible");
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

  asyncTest("no password: start with good token and site", function() {
    storage.setStagedOnBehalfOf("browserid.org");

    createController(config, function() {
      testEmail();
      ok($(".siteinfo").is(":visible"), "siteinfo is visible when we say what it is");
      equal($(".website:nth(0)").text(), "browserid.org", "origin is updated");
      testHasClass("body", "complete");
      start();
    });
  });

  asyncTest("no password: start with good token and nosite", function() {
    createController(config, function() {
      testEmail();
      equal($(".siteinfo").is(":visible"), false, "siteinfo is not visible without having it");
      equal($(".siteinfo .website").text(), "", "origin is not updated");
      start();
    });
  });

  asyncTest("no password: start with bad token", function() {
    xhr.useResult("invalid");

    createController(config, function() {
      testCannotConfirm();
      start();
    });
  });

  asyncTest("no password: start with emailForVerficationToken XHR failure", function() {
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

  asyncTest("must set password, successful login", function() {
    xhr.useResult("needsPassword");
    createController(config, function() {
      xhr.useResult("valid");

      $("#password").val("password");
      $("#vpassword").val("password");

      testHasClass("body", "enter_password");
      testHasClass("body", "enter_verify_password");

      controller.submit(function(status) {
        equal(status, true, "correct status");
        testHasClass("body", "complete");
        start();
      });
    });
  });

  asyncTest("must set password, too short a password", function() {
    xhr.useResult("needsPassword");
    createController(config, function() {
      xhr.useResult("valid");

      $("#password").val("pass");
      $("#vpassword").val("pass");

      controller.submit(function(status) {
        equal(status, false, "correct status");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

  asyncTest("must set password, too long a password", function() {
    xhr.useResult("needsPassword");
    createController(config, function() {
      xhr.useResult("valid");

      var pass = testHelpers.generateString(81);
      $("#password").val(pass);
      $("#vpassword").val(pass);

      controller.submit(function(status) {
        equal(status, false, "correct status");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

  asyncTest("must set password, missing verification password", function() {
    xhr.useResult("needsPassword");
    createController(config, function() {
      xhr.useResult("valid");

      $("#password").val("password");
      $("#vpassword").val("");

      controller.submit(function(status) {
        equal(status, false, "correct status");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

  asyncTest("must set password, mismatched passwords", function() {
    xhr.useResult("needsPassword");
    createController(config, function() {
      xhr.useResult("valid");

      $("#password").val("password");
      $("#vpassword").val("password1");

      controller.submit(function(status) {
        equal(status, false, "correct status");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

}());
