/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
(function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      errorScreen = bid.Screens.error,
      testHelpers = bid.TestHelpers,
      validToken = true,
      TEST_ORIGIN = "http://browserid.org",
      tooltip = bid.Tooltip,
      mocks = {
        confirm: function() { return true; },
        document: { location: "" }
      };

  module("pages/manage_account", {
    setup: function() {
      testHelpers.setup();
      user.setOrigin(TEST_ORIGIN);
      bid.Renderer.render("#page_head", "site/index", {});
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

  asyncTest("changePassword with missing old password, expect tooltip", function() {
    bid.manageAccount(mocks, function() {
      $("#old_password").val("");
      $("#new_password").val("newpassword");

      bid.manageAccount.changePassword(function(status) {
        equal(status, false, "on missing old password, status is false");
        equal(tooltip.shown, true, "tooltip is visible");
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
        equal(tooltip.shown, true, "tooltip is visible");
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
        equal(tooltip.shown, true, "tooltip is visible");
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
        equal(tooltip.shown, true, "tooltip is visible");
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
        equal(tooltip.shown, true, "tooltip is visible");
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

  asyncTest("changePassword happy case", function() {
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
