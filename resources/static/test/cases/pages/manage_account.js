/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      xhr = bid.Mocks.xhr,
      errorScreen = bid.Screens.error,
      storage = bid.Storage,
      testHelpers = bid.TestHelpers,
      tooltip = bid.Tooltip,
      mocks = {
        confirm: function() { return true; },
        document: { location: "" }
      };

  module("pages/manage_account", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/index", {});
      xhr.setContextInfo("auth_level", "password");
      mocks.document.location = "";
    },
    teardown: function() {
      testHelpers.teardown();
    }
  });

  asyncTest("no email addresses are displayed if there are no children", function() {
    xhr.useResult("no_identities");

    bid.manageAccount(mocks, function() {
      equal($("#emailList").children().length, 0, "no children have been added");
      start();
    });
  });

  asyncTest("email addresses added if there are children", function() {
    bid.manageAccount(mocks, function() {
      equal($("#emailList").children().length, 1, "there has been one child added");
      start();
    });
  });

  asyncTest("sync XHR error on startup", function() {
    xhr.useResult("ajaxError");

    bid.manageAccount(mocks, function() {
      equal(testHelpers.errorVisible(), true, "error message is visible on XHR error");
      start();
    });
  });

  asyncTest("removeEmail with multiple emails", function() {
    // start with multiple addresses.
    xhr.useResult("multiple");

    bid.manageAccount(mocks, function() {
      // switch to a single address return on the sync.
      xhr.useResult("valid");
      bid.manageAccount.removeEmail("testuser@testuser.com", function() {
        equal($("#emailList").children().length, 1, "after removing an email, only one remains");
        start();
      });
    });
  });

  asyncTest("removeEmail with multiple emails and XHR error", function() {
    // start with multiple addresses.
    xhr.useResult("multiple");

    bid.manageAccount(mocks, function() {
      xhr.useResult("ajaxError");
      bid.manageAccount.removeEmail("testuser@testuser.com", function() {
        equal(testHelpers.errorVisible(), true, "error message is visible on XHR error");
        start();
      });
    });
  });

  asyncTest("removeEmail with single email cancels account", function() {
    bid.manageAccount(mocks, function() {
      bid.manageAccount.removeEmail("testuser@testuser.com", function() {
        equal(mocks.document.location, "/", "redirection happened");
        start();
      });
    });
  });

  asyncTest("removeEmail with single email cancels account and XHR error", function() {
    xhr.useResult("valid");

    bid.manageAccount(mocks, function() {
      xhr.useResult("ajaxError");

      bid.manageAccount.removeEmail("testuser@testuser.com", function() {
        equal(testHelpers.errorVisible(), true, "error message is visible on XHR error");
        start();
      });
    });
  });

  asyncTest("cancelAccount", function() {
    bid.manageAccount(mocks, function() {
      bid.manageAccount.cancelAccount(function() {
        equal(mocks.document.location, "/", "redirection happened");
        start();
      });
    });
  });

  asyncTest("cancelAccount with XHR error", function() {
    bid.manageAccount(mocks, function() {
      xhr.useResult("ajaxError");
      bid.manageAccount.cancelAccount(function() {
        equal(testHelpers.errorVisible(), true, "error message is visible on XHR error");
        start();
      });
    });
  });

  asyncTest("first time a user goes to page should see help text", function() {
    bid.manageAccount(mocks,  function() {
      equal($("body").hasClass("newuser"), true, "body has the newuser class on first visit");

      bid.manageAccount(mocks, function() {
        equal($("body").hasClass("newuser"), false, "body does not have the newuser class on repeat visits");
        start();
      });
    });
  });

  asyncTest("user with only primary emails should not have 'canSetPassword' class", function() {
    xhr.useResult("primary");

    bid.manageAccount(mocks, function() {
      equal($("body").hasClass("canSetPassword"), false, "canSetPassword class not added to body");
      start();
    });
  });

  asyncTest("user with >= 1 secondary email should see have 'canSetPassword' class", function() {
    storage.addEmail("primary_user@primaryuser.com", { type: "secondary" });

    bid.manageAccount(mocks, function() {
      equal($("body").hasClass("canSetPassword"), true, "canSetPassword class added to body");
      start();
    });
  });

  asyncTest("changePassword with missing old password, expect tooltip", function() {
    bid.manageAccount(mocks, function() {
      $("#old_password").val("");
      $("#new_password").val("newpassword");

      bid.manageAccount.changePassword(function(status) {
        equal(status, false, "on missing old password, status is false");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

  asyncTest("changePassword with missing new password, expect tooltip", function() {
    bid.manageAccount(mocks, function() {
      $("#old_password").val("oldpassword");
      $("#new_password").val("");

      bid.manageAccount.changePassword(function(status) {
        equal(status, false, "on missing new password, status is false");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

  asyncTest("changePassword with too short of a password, expect tooltip", function() {
    bid.manageAccount(mocks, function() {
      $("#old_password").val("oldpassword");
      $("#new_password").val("pass");

      bid.manageAccount.changePassword(function(status) {
        equal(status, false, "on too short of a password, status is false");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

  asyncTest("changePassword with too long of a password, expect tooltip", function() {
    bid.manageAccount(mocks, function() {
      $("#old_password").val("oldpassword");
      var tooLong = "";
      for(var i = 0; i < 81; i++) {
        tooLong += (i % 10);
      }
      $("#new_password").val(tooLong);

      bid.manageAccount.changePassword(function(status) {
        equal(status, false, "on too short of a password, status is false");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });


  asyncTest("changePassword with incorrect old password, expect tooltip", function() {
    bid.manageAccount(mocks, function() {
      xhr.useResult("incorrectPassword");

      $("#old_password").val("incorrectpassword");
      $("#new_password").val("newpassword");

      bid.manageAccount.changePassword(function(status) {
        equal(status, false, "on incorrect old password, status is false");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

  asyncTest("changePassword with XHR error, expect error message", function() {
    bid.manageAccount(mocks, function() {
      xhr.useResult("invalid");

      $("#old_password").val("oldpassword");
      $("#new_password").val("newpassword");

      bid.manageAccount.changePassword(function(status) {
        equal(status, false, "on xhr error, status is false");
        start();
      });
    });
  });

  asyncTest("changePassword with user authenticated to password level, happy case", function() {

    bid.manageAccount(mocks, function() {
      $("#old_password").val("oldpassword");
      $("#new_password").val("newpassword");

      bid.manageAccount.changePassword(function(status) {
        equal(status, true, "on proper completion, status is true");
        equal(tooltip.shown, false, "on proper completion, tooltip is not shown");
        start();
      });
    });
  });

  asyncTest("changePassword with user authenticated to assertion level level, incorrect password - show tooltip", function() {
    xhr.setContextInfo("auth_level", "assertion");

    bid.manageAccount(mocks, function() {
      $("#old_password").val("oldpassword");
      $("#new_password").val("newpassword");
      xhr.useResult("incorrectPassword");

      bid.manageAccount.changePassword(function(status) {
        equal(status, false, "bad password, status is false");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

  asyncTest("changePassword with user authenticated to assertion level level, correct password - log user in, change password", function() {
    xhr.setContextInfo("auth_level", "assertion");

    bid.manageAccount(mocks, function() {
      $("#old_password").val("oldpassword");
      $("#new_password").val("newpassword");

      bid.manageAccount.changePassword(function(status) {
        equal(status, true, "on proper completion, status is true");
        equal(tooltip.shown, false, "on proper completion, tooltip is not shown");
        start();
      });
    });
  });

}());
