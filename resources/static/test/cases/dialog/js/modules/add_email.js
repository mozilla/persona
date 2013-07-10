/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      el = $("body"),
      bid = BrowserID,
      user = bid.User,
      storage = bid.Storage,
      xhr = bid.Mocks.xhr,
      modules = bid.Modules,
      testHelpers = bid.TestHelpers,
      testTooltipVisible = testHelpers.testTooltipVisible,
      register = testHelpers.register;


  module("dialog/js/modules/add_email", {
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
    controller.start(options || {});
  }

  function testEmailBelongsToUser(typedEmail, normalizedEmail) {
    createController();

    $("#newEmail").val(typedEmail);

    register("stage_email", function(msg, info) {
      ok(false, "unexpected stage_email message");
    });

    // simulate the email being already added.
    user.syncEmailKeypair(normalizedEmail, function() {
      controller.addEmail(function() {
        testHelpers.testNotVisible(".addressInfo");
        testTooltipVisible();
        start();
      });
    });
  }

  function testEmailCanBeAdded(typedEmail, normalizedEmail) {
    createController();

    equal($("#addEmail").length, 1, "control rendered correctly");

    $("#newEmail").val(typedEmail);

    var stagedEmail;
    register("stage_email", function(msg, info) {
      stagedEmail = info.email;
    });

    controller.addEmail(function() {
      equal(stagedEmail, normalizedEmail, "stage_email called with correct email");
      testHelpers.testNotVisible(".addressInfo");
      start();
    });
  }



  test("addEmail with specified email address - fill in email", function() {
    createController({ email: "testuser@testuser.com" });
    ok($("#newEmail").val(), "testuser@testuser.com", "email prepopulated");
  });

  asyncTest("addEmail with first valid unknown secondary email - trigger stage_email", function() {
    testEmailCanBeAdded("unregistered@testuser.com",
        "unregistered@testuser.com");
  });

  asyncTest("addEmail with second valid unknown secondary email - trigger stage_email", function() {
    testEmailCanBeAdded("unregistered@testuser.com",
        "unregistered@testuser.com");
  });

  asyncTest("addEmail with second valid unknown secondary email that needs to be normalized - trigger stage_email", function() {
    testEmailCanBeAdded("UNREGISTERED@TESTUSER.COM",
        "unregistered@testuser.com");
  });

  asyncTest("addEmail with valid unknown secondary email with leading/trailing whitespace - allows address, triggers stage_email", function() {
    testEmailCanBeAdded("    unregistered@testuser.com    ",
        "unregistered@testuser.com");
  });

  asyncTest("addEmail with invalid email", function() {
    createController();

    $("#newEmail").val("unregistered");
    var handlerCalled = false;
    register("stage_email", function(msg, info) {
      handlerCalled = true;
      ok(false, "stage_email should not be called on invalid email");
    });
    controller.addEmail(function() {
      equal(handlerCalled, false, "the stage_email handler should have never been called");
      start();
    });
  });

  asyncTest("addEmail with first secondary email belonging to another user - allows for account consolidation", function() {
    xhr.useResult("known_secondary");
    testEmailCanBeAdded("registered@testuser.com",
        "registered@testuser.com");
  });

  asyncTest("addEmail with email belonging to current user - prints tooltip", function() {
    testEmailBelongsToUser("registered@testuser.com",
        "registered@testuser.com");
  });

  asyncTest("addEmail with email belonging to current user - prints tooltip", function() {
    testEmailBelongsToUser("REGISTERED@TESTUSER.COM",
        "registered@testuser.com");
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
