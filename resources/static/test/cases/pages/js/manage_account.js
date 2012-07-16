/*jshint browser: true, forin: true, laxbreak: true */
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

  module("pages/js/manage_account", {
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

  asyncTest("show sorted email addresses", function() {
    xhr.useResult("multiple");

    bid.manageAccount(mocks, function() {
      equal($("#emailList").children().length, 2, "there two children added");

      var firstLI = $("#testuser2_testuser_com");
      var secondLI = $("#testuser_testuser_com");

      equal(firstLI.next().is(secondLI), true, "names are in alphabetical order");

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

  asyncTest("removeEmail doesn't cancel the account when removing a non-existent e-mail", function() {
    bid.manageAccount(mocks, function() {
      bid.manageAccount.removeEmail("non@existent.com", function() {
        notEqual(mocks.document.location, "/", "redirection did not happen");
        start();
      });
    });
  });

  asyncTest("removeEmail doesn't cancel the account when out of sync with the server", function() {
    bid.manageAccount(mocks, function() {
      xhr.useResult("multiple");
      bid.manageAccount.removeEmail("testuser@testuser.com", function() {
        notEqual(mocks.document.location, "/", "redirection did not happen");
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

  asyncTest("changePassword with missing old password - tooltip", function() {
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

  asyncTest("changePassword with missing new password - tooltip", function() {
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

  asyncTest("changePassword with too short of a password - tooltip", function() {
    bid.manageAccount(mocks, function() {
      $("#old_password").val("oldpassword");
      $("#new_password").val(testHelpers.generateString(bid.PASSWORD_MIN_LENGTH - 1));

      bid.manageAccount.changePassword(function(status) {
        equal(status, false, "on too short of a password, status is false");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

  asyncTest("changePassword with too long of a password - tooltip", function() {
    bid.manageAccount(mocks, function() {
      $("#old_password").val("oldpassword");
      $("#new_password").val(testHelpers.generateString(bid.PASSWORD_MAX_LENGTH + 1));

      bid.manageAccount.changePassword(function(status) {
        equal(status, false, "on too long of a password, status is false");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });


  asyncTest("changePassword with incorrect old password - tooltip", function() {
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

  asyncTest("changePassword with same old and new password - tooltip", function() {
    bid.manageAccount(mocks, function() {
      $("#old_password").val("password");
      $("#new_password").val("password");

      bid.manageAccount.changePassword(function(status) {
        equal(status, false, "do not update when old and new passwords are the same");
        testHelpers.testTooltipVisible();
        start();
      });
    });
  });

  asyncTest("changePassword with XHR error - error message", function() {
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

        equal($("#old_password").val(), "", "old_password field is cleared");
        equal($("#new_password").val(), "", "new_password field is cleared");

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
