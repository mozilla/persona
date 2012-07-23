/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true, notEqual: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      xhr = bid.Mocks.xhr,
      errorScreen = bid.Screens.error,
      network = bid.Network,
      storage = bid.Storage,
      testHelpers = bid.TestHelpers,
      generateString = testHelpers.generateString,
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

  function testPasswordChangeSuccess(oldPass, newPass, msg) {
    testPasswordChange(oldPass, newPass, function(status) {
      equal(status, true, msg);
      // if success is expected, both password fields should be visible.
      equal($("#old_password").val(), "", "old_password field is cleared");
      equal($("#new_password").val(), "", "new_password field is cleared");
      testHelpers.testTooltipNotVisible();
      network.checkAuth(function(authLevel) {
        equal(authLevel, "password", "after password change, user authenticated to password level");
        start();
      }, testHelpers.unexpectedXHRFailure);
    }, msg);
  }

  function testPasswordChangeFailure(oldPass, newPass, msg) {
    testPasswordChange(oldPass, newPass, function(status) {
      equal(status, false, msg);
      testHelpers.testTooltipVisible();
      start();
    }, msg);
  }

  function testPasswordChange(oldPass, newPass, testStrategy, msg) {
    bid.manageAccount(mocks, function() {
      $("#old_password").val(oldPass);
      $("#new_password").val(newPass);

      bid.manageAccount.changePassword(testStrategy);
    });
  }

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
    testPasswordChangeFailure("", "newpassword", "missing old password, expected failure");
  });

  asyncTest("changePassword with too short of an old password - tooltip", function() {
    testPasswordChangeFailure(generateString(bid.PASSWORD_MIN_LENGTH - 1), "newpassword", "missing old password, expected failure");
  });

  asyncTest("changePassword with too long of an old password - tooltip", function() {
    testPasswordChangeFailure(generateString(bid.PASSWORD_MAX_LENGTH + 1), "newpassword", "missing old password, expected failure");
  });

  asyncTest("changePassword with missing new password - tooltip", function() {
    testPasswordChangeFailure("oldpassword", "", "missing new password, expected failure");
  });

  asyncTest("changePassword with too short of a new password - tooltip", function() {
    testPasswordChangeFailure("oldpassword", generateString(bid.PASSWORD_MIN_LENGTH - 1), "too short new password, expected failure");
  });

  asyncTest("changePassword with too long of a new password - tooltip", function() {
    testPasswordChangeFailure("oldpassword", generateString(bid.PASSWORD_MAN_LENGTH + 1), "too short new password, expected failure");
  });


  asyncTest("changePassword with same old and new password - tooltip", function() {
    testPasswordChangeFailure("password", "password", "password same, expected failure");
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

  asyncTest("changePassword with user authenticated to password level, incorrect old password - tooltip", function() {
    xhr.setContextInfo("auth_level", "password");
    xhr.useResult("incorrectPassword");
    testPasswordChangeFailure("incorrectpassword", "newpassword", "incorrect old password, expected failure");
  });

  asyncTest("changePassword with user authenticated to assertion level, incorrect password - show tooltip", function() {
    xhr.setContextInfo("auth_level", "assertion");
    xhr.useResult("incorrectPassword");

    testPasswordChangeFailure("oldpassword", "newpassword", "incorrect old password, expected failure");
  });

  asyncTest("changePassword with user authenticated to password level, happy case", function() {
    xhr.setContextInfo("auth_level", "password");

    testPasswordChangeSuccess("oldpassword", "newpassword", "proper completion, no need to authenticate");
  });

  asyncTest("changePassword with user authenticated to assertion level level, correct password - log user in, change password", function() {
    xhr.setContextInfo("auth_level", "assertion");

    testPasswordChangeSuccess("oldpassword", "newpassword", "proper completion after authenticating user");
  });

}());
