/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      pageHelpers = bid.PageHelpers,
      testHelpers = bid.TestHelpers,
      testVisible = testHelpers.testVisible,
      testNotVisible = testHelpers.testNotVisible,
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
      bid.Renderer.render("#page_head", "site/signin", {});
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
    bid.Renderer.render("#page_head", "site/verify_email_address", {});
    pageHelpers.replaceFormWithNotice("#congrats", function() {
      testNotVisible("form");
      testVisible("#congrats");
      start();
    });
  });

  asyncTest("replaceInputsWithNotice replaces contents", function() {
    pageHelpers.replaceInputsWithNotice(".emailsent", function() {
      testVisible(".emailsent");
      testNotVisible(".forminputs");
      start();
    });
  });

  asyncTest("showInputs hides notices and shows the inputs", function() {
    pageHelpers.replaceInputsWithNotice(".emailsent", function() {
      pageHelpers.showInputs(function() {
        testNotVisible(".emailsent");
        testVisible(".forminputs");
        start();
      });
    });
  });


  asyncTest("emailSent shows correct email sent message, starts waiting for user validation", function() {
    // set the result to complete to immediately return.  We'll test each case
    // below.
    xhr.useResult("complete");

    pageHelpers.emailSent("waitForUserValidation", "registered@testuser.com", function() {
      equal($("#sentToEmail").html(), "registered@testuser.com", "correct email is set");
      testVisible(".emailsent");
      testNotVisible(".forminputs");
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

  asyncTest("cancelEmailSent - inputs are shown again", function() {
    xhr.useResult("complete");
    pageHelpers.emailSent("waitForUserValidation", "registered@testuser.com", function() {
      pageHelpers.cancelEmailSent(function() {
        testNotVisible(".emailsent");
        testVisible(".forminputs");
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
        testVisible("#error .moreInfo", "extra info is visible after click");
        start();
      }, 100);

    });
  });

}());


