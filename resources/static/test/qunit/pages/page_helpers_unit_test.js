/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID: true */
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
      pageHelpers = bid.PageHelpers,
      testHelpers = bid.TestHelpers,
      errors = bid.Errors;

  module("pages/page_helpers", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/signup", {});
      $(".siteinfo,.emailsent").hide();
    },

    teardown: function() {
      testHelpers.teardown();
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


  asyncTest("showEmailSent shows correct email sent message", function() {
    pageHelpers.setStoredEmail("testuser@testuser.com");
    pageHelpers.showEmailSent(function() {
      equal($("#sentToEmail").html(), "testuser@testuser.com", "correct email is set");
      equal($(".emailsent").is(":visible"), true, "emailsent is visible");
      equal($(".forminputs").is(":visible"), false, "inputs are hidden");
      start();
    });
  });

  asyncTest("cancelEmailSent restores the stored email, inputs are shown again", function() {
    pageHelpers.setStoredEmail("testuser@testuser.com");
    pageHelpers.showEmailSent(function() {
      pageHelpers.cancelEmailSent(function() {
        var email = pageHelpers.getStoredEmail();
        equal(email, "testuser@testuser.com", "stored email is reset on cancel");
        equal($(".emailsent").is(":visible"), false, "emailsent is not visible");
        equal($(".forminputs").is(":visible"), true, "inputs are visible");
 //       equal($("#email").is(":focus"), true, "first element is focused (NOTE: requires your browser to be focused to work)");
        start();
      });
    });
  });

  asyncTest("showFailure shows a failure screen", function() {
    pageHelpers.showFailure({}, errors.offline, function() {
      testHelpers.testErrorVisible();
      start();
    });
  });

}());


