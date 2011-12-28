/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
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

  var controller,
      bid = BrowserID,
      storage = bid.Storage,
      testHelpers = bid.TestHelpers,
      xhr = bid.Mocks.xhr,
      register = bid.TestHelpers.register;

  module("controllers/set_password", {
    setup: function() {
      testHelpers.setup();
      createController();
      $("#password").val("");
      $("#vpassword").val("");
    },

    teardown: function() {
      if (controller) {
        try {
          controller.destroy();
          controller = null;
        } catch(e) {
          // could already be destroyed from the close
        }
      }
      testHelpers.setup();
    }
  });


  function createController(options) {
    controller = bid.Modules.SetPassword.create();
    controller.start(options);
  }

  function testInvalidInput() {
    controller.setPassword(function(status) {
      equal(false, status, "status is false");
      testHelpers.testTooltipVisible();
      start();
    });
  }

  test("create displays the correct template", function() {
    equal($("#set_password").length, 1, "the correct template is displayed");
  });

  asyncTest("setPassword with no password", function() {
    $("#password").val("");
    $("#vpassword").val("password");
    testInvalidInput();
  });

  asyncTest("setPassword with no verification password", function() {
    $("#password").val("password");
    $("#vpassword").val("");
    testInvalidInput();
  });

  asyncTest("setPassword with too short of a password", function() {
    $("#password").val("pass");
    $("#vpassword").val("pass");
    testInvalidInput();
  });

  asyncTest("setPassword with mismatched passwords", function() {
    $("#password").val("passwords");
    $("#vpassword").val("password");
    testInvalidInput();
  });

  asyncTest("setPassword with XHR error", function() {
    $("#password").val("password");
    $("#vpassword").val("password");
    xhr.useResult("ajaxError");

    controller.setPassword(function(status) {
      equal(status, false, "correct status");
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("setPassword happy case", function() {
    $("#password").val("password");
    $("#vpassword").val("password");


    register("password_set", function(msg, info) {
      ok(true, msg + " message received");
      start();
    });

    controller.setPassword(function(status) {
      equal(status, true, "correct status");
    });
  });
}());

