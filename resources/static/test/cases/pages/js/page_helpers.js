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
      bid.Renderer.render("#page_head", "add_email", {});
      $(".siteinfo,.emailsent").hide();
    },

    teardown: function() {
      testHelpers.teardown();
      pageHelpers.reset();
    }
  });


  asyncTest("replaceFormWithNotice replaces contents", function() {
    bid.Renderer.render("#page_head", "site/reset_password", {});
    pageHelpers.replaceFormWithNotice("#congrats", function() {
      testNotVisible("form");
      testVisible("#congrats");
      start();
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


