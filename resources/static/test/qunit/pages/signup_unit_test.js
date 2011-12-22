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
      xhr = bid.Mocks.xhr,
      WinChanMock = bid.Mocks.WinChan,
      testHelpers = bid.TestHelpers,
      provisioning = bid.Mocks.Provisioning,
      winchan;

  module("pages/signup", {
    setup: function() {
      testHelpers.setup();

      winchan = new WinChanMock();
      bid.signUp({
        winchan: winchan
      });
    },
    teardown: function() {
      testHelpers.teardown();
      bid.signUp.reset();
    }
  });

  function testNotRegistered(extraTests) {
    bid.signUp.submit(function(status) {
      strictEqual(status, false, "address was not registered");
      equal($(".emailsent").is(":visible"), false, "email not sent, notice not visible");

      if(extraTests) extraTests();
      start();
    });
  }

  asyncTest("signup with valid unregistered secondary email", function() {
    xhr.useResult("unknown_secondary");

    $("#email").val("unregistered@testuser.com");

    bid.signUp.submit(function() {
      equal($(".emailsent").is(":visible"), true, "email sent, notice visible");
      start();
    });
  });

  asyncTest("signup with valid unregistered email with leading/trailing whitespace", function() {
    xhr.useResult("unknown_secondary");

    $("#email").val(" unregistered@testuser.com ");

    bid.signUp.submit(function() {
      equal($(".emailsent").is(":visible"), true, "email sent, notice visible");
      start();
    });
  });

  asyncTest("signup with valid registered email", function() {
    xhr.useResult("known_secondary");
    $("#email").val("registered@testuser.com");

    testNotRegistered();
  });

  asyncTest("signup with invalid email address", function() {
    $("#email").val("invalid");

    testNotRegistered();
  });

  asyncTest("signup with throttling", function() {
    xhr.useResult("throttle");

    $("#email").val("unregistered@testuser.com");

    testNotRegistered();
  });

  asyncTest("signup with XHR error", function() {
    xhr.useResult("invalid");
    $("#email").val("unregistered@testuser.com");

    testNotRegistered(function() {
      testHelpers.testErrorVisible();
    });
  });

  asyncTest("signup with unregistered secondary email and cancel button pressed", function() {
    xhr.useResult("unknown_secondary");
    $("#email").val("unregistered@testuser.com");

    bid.signUp.submit(function() {
      bid.signUp.back(function() {
        equal($(".notification:visible").length, 0, "no notifications are visible");
        equal($(".forminputs:visible").length, 1, "form inputs are again visible");
        equal($("#email").val(), "unregistered@testuser.com", "email address restored");
        start();
      });
    });
  });

  asyncTest("signup with primary email address, provisioning failure - expect error screen", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");
    provisioning.setFailure({
      code: "internal",
      msg: "doowap"
    });

    bid.signUp.submit(function(status) {
      equal(status, false, "provisioning failure, status false");
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("signup with primary email address, user verified by primary - print success message", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");
    provisioning.setStatus(provisioning.AUTHENTICATED);

    bid.signUp.submit(function(status) {
      equal(status, true, "primary addition success - true status");
      equal($("#congrats:visible").length, 1, "success notification is visible");
      start();
    });
  });

  asyncTest("signup with primary email address, user must verify with primary", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    bid.signUp.submit(function(status) {
      equal($("#primary_verify:visible").length, 1, "success notification is visible");
      equal($("#primary_email").text(), "unregistered@testuser.com", "correct email shown");
      equal(status, false, "user must authenticate, some action needed.");
      start();
    });
  });

  asyncTest("authWithPrimary opens new tab", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    bid.signUp.submit(function(status) {
      bid.signUp.authWithPrimary(function() {
        ok(winchan.oncomplete, "winchan set up");
        start();
      });
    });
  });

  asyncTest("primaryAuthComplete with error, expect incorrect status", function() {
    bid.signUp.primaryAuthComplete("error", "", function(status) {
      equal(status, false, "correct status for could not complete");
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("primaryAuthComplete with successful authentication, expect correct status and congrats message", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    bid.signUp.submit(function(status) {
      bid.signUp.authWithPrimary(function() {
        // In real life the user would now be authenticated.
        provisioning.setStatus(provisioning.AUTHENTICATED);
        bid.signUp.primaryAuthComplete(null, "success", function(status) {
          equal(status, true, "correct status");
          equal($("#congrats:visible").length, 1, "success notification is visible");
          start();
        });
      });
    });
  });

}());
