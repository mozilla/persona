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
      el = $("body"),
      bid = BrowserID,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      //provisioning = bid.Mocks.Provisioning,
      modules = bid.Modules,
      testHelpers = bid.TestHelpers,
      register = testHelpers.register;


  module("controllers/add_email", {
    setup: function() {
      $("#newEmail").val("");
      testHelpers.setup();
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
      testHelpers.teardown();
    }
  });

  function createController(options) {
    controller = modules.AddEmail.create();
    controller.start(options);
  }

  asyncTest("addEmail with valid unknown secondary email", function() {
    createController();
    xhr.useResult("unknown_secondary");

    equal($("#addEmail").length, 1, "control rendered correctly");

    $("#newEmail").val("unregistered@testuser.com");

    register("email_staged", function(msg, info) {
      equal(info.email, "unregistered@testuser.com", "email_staged called with correct email");
      start();
    });

    controller.addEmail();
  });

  asyncTest("addEmail with valid unknown secondary email with leading/trailing whitespace", function() {
    createController();
    xhr.useResult("unknown_secondary");

    $("#newEmail").val("   unregistered@testuser.com  ");
    register("email_staged", function(msg, info) {
      equal(info.email, "unregistered@testuser.com", "email_staged called with correct email");
      start();
    });
    controller.addEmail();
  });

  asyncTest("addEmail with invalid email", function() {
    createController();

    $("#newEmail").val("unregistered");
    var handlerCalled = false;
    register("email_staged", function(msg, info) {
      handlerCalled = true;
      ok(false, "email_staged should not be called on invalid email");
    });
    controller.addEmail(function() {
      equal(handlerCalled, false, "the email_staged handler should have never been called");
      start();
    });
  });

  asyncTest("addEmail with email belonging to current user - prints tooltip", function() {
    createController();

    $("#newEmail").val("registered@testuser.com");

    register("email_staged", function(msg, info) {
      ok(false, "unexpected email_staged message");
    });

    // simulate the email being already added.
    user.syncEmailKeypair("registered@testuser.com", function() {
      // Set result to known_secondary in here so that we do not have to add
      // another line to the XHR mock for syncEmailKeypair.
      xhr.useResult("known_secondary");
      controller.addEmail(function() {
        ok(bid.Tooltip.shown, "tooltip should be shown");
        start();
      });
    });
  });

  asyncTest("addEmail with secondary email belonging to another user - allows for account consolidation", function() {
    createController();
    xhr.useResult("known_secondary");

    $("#newEmail").val("registered@testuser.com");
    register("email_staged", function(msg, info) {
      equal(info.email, "registered@testuser.com", "email_staged called with correct email");
      start();
    });
    controller.addEmail();
  });

  asyncTest("cancelAddEmail", function() {
    createController();

    register("cancel_state", function(msg, info) {
      ok(true, "cancelling the add email");
      start();
    });
    controller.cancelAddEmail();
  });


  asyncTest("addEmail with unknown primary email", function() {
    createController();
    xhr.useResult("primary");
    $("#newEmail").val("unregistered@testuser.com");

    register("primary_user", function(msg, info) {
      equal(info.email, "unregistered@testuser.com", "email set correctly");
      equal(info.add, true, "true flag specified");
      ok(info.auth, "auth URL exists in info");
      ok(info.prov, "prov URL exists in info");
      start();
    });

    controller.addEmail(function(status) {
      equal(status, true, "user added, correct status");
    });
  });

  asyncTest("addEmail after having an account with primary email keeps both email addresses", function() {
    createController();

    xhr.useResult("primary");
    $("#newEmail").val("unregistered@testuser.com");

    controller.addEmail(function(status) {
      $("#newEmail").val("testuser@testuser.com");
      controller.addEmail(function(status) {
        equal(status, true, "user added, correct status");
        start();
      });
    });
  });

}());
