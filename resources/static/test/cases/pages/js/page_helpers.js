/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      pageHelpers = bid.PageHelpers,
      testHelpers = bid.TestHelpers,
      user = bid.User,
      WindowMock = bid.Mocks.WindowMock,
      winMock,
      xhr = bid.Mocks.xhr,
      errors = bid.Errors;

  module("pages/js/page_helpers", {
    setup: function() {
      testHelpers.setup();
      winMock = new WindowMock();
      pageHelpers.init({ window: winMock });
      bid.Renderer.render("#page_head", "site/signup", {});
      $(".siteinfo,.emailsent").hide();
    },

    teardown: function() {
      testHelpers.teardown();
      pageHelpers.reset();
    }
  });


  test("setStoredEmail/getStoredEmail/setupEmail prefills the email address", function() {
    $("#email").val("");

    pageHelpers.setStoredEmail("testuser@testuser.com");
    pageHelpers.setupEmail();

    equal($("#email").val(), "testuser@testuser.com", "email was set on setupEmail");
    equal(pageHelpers.getStoredEmail(), "testuser@testuser.com", "getStoredEmail works correctly");
  });

  test("a key press in the email address field saves it", function() {
    $("#email").val("");

    pageHelpers.setStoredEmail("testuser@testuser.co");
    pageHelpers.setupEmail();

    // The fake jQuery event does not actually cause the letter to be added, we
    // have to do that manually.
    $("#email").val("testuser@testuser.com");

    var e = jQuery.Event("keyup");
    e.which = 77; //choose the one you want
    e.keyCode = 77;
    $("#email").trigger(e);

    equal(pageHelpers.getStoredEmail(), "testuser@testuser.com", "hitting a key updates the stored email");
  });

  test("clearStoredEmail clears the email address from storage", function() {
    pageHelpers.clearStoredEmail();

    equal(pageHelpers.getStoredEmail(), "", "clearStoredEmail clears stored email");
  });

  asyncTest("replaceFormWithNotice replaces contents", function() {
    pageHelpers.replaceFormWithNotice("#congrats", function() {
      equal($("form").is(":visible"), false, "form has been hidden");
      equal($("#congrats").is(":visible"), true, "congrats is now visible");
      start();
    });
  });

  asyncTest("replaceInputsWithNotice replaces contents", function() {
    pageHelpers.replaceInputsWithNotice(".emailsent", function() {
      equal($(".emailsent").is(":visible"), true, "emailsent is visible");
      equal($(".forminputs").is(":visible"), false, "inputs are hidden");
      start();
    });
  });

  asyncTest("showInputs hides notices and shows the inputs", function() {
    pageHelpers.replaceInputsWithNotice(".emailsent", function() {
      pageHelpers.showInputs(function() {
        equal($(".emailsent").is(":visible"), false, "emailsent is hidden");
        equal($(".forminputs").is(":visible"), true, "inputs are shown");
        start();
      });
    });
  });


  asyncTest("emailSent shows correct email sent message, starts waiting for user validation", function() {
    pageHelpers.setStoredEmail("registered@testuser.com");

    // set the result to complete to immediately return.  We'll test each case
    // below.
    xhr.useResult("complete");

    pageHelpers.emailSent(function() {
      equal($("#sentToEmail").html(), "registered@testuser.com", "correct email is set");
      equal($(".emailsent").is(":visible"), true, "emailsent is visible");
      equal($(".forminputs").is(":visible"), false, "inputs are hidden");
      start();
    });

  });

  test("userValidationComplete with status=pending - do nothing", function() {
    pageHelpers.userValidationComplete("pending");

    equal(winMock.document.location.href, document.location.href, "with pending status, no change");
  });

  test("userValidationComplete with status=noRegistration - do nothing", function() {
    pageHelpers.userValidationComplete("noRegistration");

    equal(winMock.document.location.href, document.location.href, "with noRegistration status, no change");
  });

  test("userValidationComplete with status=mustAuth - redirect to /signin", function() {
    pageHelpers.userValidationComplete("mustAuth");

    equal(winMock.document.location.href, "/signin", "with mustAuth status, redirect to signin");
  });

  test("userValidationComplete with status=complete - redirect to /", function() {
    pageHelpers.userValidationComplete("complete");

    equal(winMock.document.location.href, "/", "with complete status, redirect to /");
  });

  asyncTest("cancelEmailSent restores the stored email, inputs are shown again", function() {
    pageHelpers.setStoredEmail("registered@testuser.com");
    xhr.useResult("complete");
    pageHelpers.emailSent(function() {
      pageHelpers.cancelEmailSent(function() {
        var email = pageHelpers.getStoredEmail();
        equal(email, "registered@testuser.com", "stored email is reset on cancel");
        equal($(".emailsent").is(":visible"), false, "emailsent is not visible");
        equal($(".forminputs").is(":visible"), true, "inputs are visible");
 //       equal($("#email").is(":focus"), true, "first element is focused (NOTE: requires your browser to be focused to work)");
        start();
      });
    });
  });

  asyncTest("showFailure - show a failure screen, extended info can be opened", function() {
    pageHelpers.showFailure("error", { network: 400, status: "error"}, function() {
      testHelpers.testErrorVisible();

      // We have to make sure the error screen itself is visible and that the
      // extra info is hidden so when we click on the extra info it opens.
      $("#error").show();
      $("#error .moreInfo").hide();
      $("#error .openMoreInfo").trigger("click");

      // Add a bit of delay to wait for the animation
      setTimeout(function() {
        equal($("#error .moreInfo").is(":visible"), true, "extra info is visible after click");
        start();
      }, 100);

    });
  });

}());


