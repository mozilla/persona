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
      network = bid.Network,
      storage = bid.Storage,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      validToken = true,
      TEST_ORIGIN = "http://browserid.org",
      TEST_DELAY = 100,
      ERROR_DELAY = 250,
      mocks = {
        confirm: function() { return true; },
        document: { location: "" }
      };

  module("pages/manage_account", {
    setup: function() {
      network.setXHR(xhr);
      xhr.useResult("valid");
      user.setOrigin(TEST_ORIGIN);
      $("#emailList").empty();
      $(".error").removeClass("error");
      $("#error").hide();
      mocks.document.location = "";
      storage.clear();
    },
    teardown: function() {
      network.setXHR($);
      $("#emailList").empty();
      $(".error").removeClass("error");
      $("#error").hide();
    }
  });

  asyncTest("no email addresses are displayed if there are no children", function() {
    xhr.useResult("noidentities");

    bid.manageAccount(mocks);

    setTimeout(function() {
      equal($("#emailList").children().length, 0, "no children have been added");
      start();
    }, TEST_DELAY);

    
  });

  asyncTest("email addresses added if there are children", function() {
    bid.manageAccount(mocks);

    setTimeout(function() {
      equal($("#emailList").children().length, 1, "there has been one child added");
      start();
    }, TEST_DELAY);

    
  });

  asyncTest("sync XHR error on startup", function() {
    xhr.useResult("ajaxError");

    bid.manageAccount(mocks);

    setTimeout(function() {
      equal($("#error").is(":visible"), true, "error message is visible on XHR error");
      start();
    }, ERROR_DELAY);

    
  });

  asyncTest("removeEmail with multiple emails", function() {
    // start with multiple addresses.
    xhr.useResult("multiple");

    bid.manageAccount(mocks);

    setTimeout(function() {
      // switch to a single address return on the sync.
      xhr.useResult("valid");
      bid.manageAccount.removeEmail("testuser@testuser.com");

      setTimeout(function() {
        equal($("#emailList").children().length, 1, "after removing an email, only one remains");
        start();
      }, TEST_DELAY);
    }, TEST_DELAY);

    
  });

  asyncTest("removeEmail with multiple emails and XHR error", function() {
    // start with multiple addresses.
    xhr.useResult("multiple");

    bid.manageAccount(mocks);

    setTimeout(function() {
      xhr.useResult("ajaxError");
      bid.manageAccount.removeEmail("testuser@testuser.com");

      setTimeout(function() {
        equal($("#error").is(":visible"), true, "error message is visible on XHR error");
        start();
      }, ERROR_DELAY);
    }, TEST_DELAY);

    
  });

  asyncTest("removeEmail with single email cancels account", function() {
    bid.manageAccount(mocks);

    setTimeout(function() {
      bid.manageAccount.removeEmail("testuser@testuser.com");

      setTimeout(function() {
        equal(mocks.document.location, "/", "redirection happened");
        start();
      }, TEST_DELAY);
    }, TEST_DELAY);

    
  });

  asyncTest("removeEmail with single email cancels account and XHR error", function() {
    xhr.useResult("valid");

    bid.manageAccount(mocks);

    setTimeout(function() {
      xhr.useResult("ajaxError");

      bid.manageAccount.removeEmail("testuser@testuser.com");

      setTimeout(function() {
        equal($("#error").is(":visible"), true, "error message is visible on XHR error");
        start();
      }, ERROR_DELAY);
    }, TEST_DELAY);

    
  });

  asyncTest("cancelAccount", function() {
    bid.manageAccount(mocks);

    setTimeout(function() {
      bid.manageAccount.cancelAccount();

      setTimeout(function() {
        equal(mocks.document.location, "/", "redirection happened");
        start();
      }, TEST_DELAY);

    }, TEST_DELAY);

    
  });

  asyncTest("cancelAccount with XHR error", function() {
    bid.manageAccount(mocks);

    setTimeout(function() {
      xhr.useResult("ajaxError");
      bid.manageAccount.cancelAccount();

      setTimeout(function() {
        equal($("#error").is(":visible"), true, "error message is visible on XHR error");
        start();
      }, ERROR_DELAY);
    }, TEST_DELAY);

    
  });

}());
