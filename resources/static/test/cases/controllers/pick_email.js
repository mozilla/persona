/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      storage = bid.Storage,
      testHelpers = bid.TestHelpers,
      testOrigin = testHelpers.testOrigin,
      register = bid.TestHelpers.register;

  module("controllers/pick_email", {
    setup: function() {
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


  function createController(allowPersistent) {
    controller = bid.Modules.PickEmail.create();
    controller.start({
      allow_persistent: allowPersistent || false
    });
  }

  test("multiple emails - print emails in alphabetical order", function() {
    storage.addEmail("third@testuser.com", {});
    storage.addEmail("second@testuser.com", {});
    storage.addEmail("first@testuser.com", {});

    createController();

    var firstLI = $("#first_testuser_com").closest("li");
    var secondLI = $("#second_testuser_com").closest("li");
    var thirdLI = $("#third_testuser_com").closest("li");

    equal(firstLI.next().is(secondLI), true, "first is before second");
    equal(secondLI.next().is(thirdLI), true, "second is before third");
  });

  test("pickemail controller with email associated with site - check correct email", function() {
    storage.addEmail("testuser@testuser.com", {});
    storage.addEmail("testuser2@testuser.com", {});
    storage.site.set(testOrigin, "email", "testuser2@testuser.com");

    createController();

    var radioButton = $("input[type=radio]").eq(0);
    ok(radioButton.is(":checked"), "the email address we specified is checked");

    var label = radioButton.parent();
    ok(label.hasClass("preselected"), "the label has the preselected class");
  });

  test("pickemail controller without email associated with site checks first radio button", function() {
    storage.addEmail("testuser@testuser.com", {});

    createController();

    var radioButton = $("input[type=radio]").eq(0);
    equal(radioButton.is(":checked"), true, "The email address is not checked");

    var label = radioButton.parent();
    equal(label.hasClass("preselected"), false, "the label has no class");
  });

  function testRemember(allowPersistent, remember) {
    storage.addEmail("testuser@testuser.com", {});
    storage.addEmail("testuser2@testuser.com", {});
    storage.site.set(testOrigin, "remember", remember);

    createController(allowPersistent);

    // remember can only be checked if allowPersistent is allowed
    var rememberChecked = allowPersistent ? remember : false;

    equal($("#remember").is(":checked"), rememberChecked, "remember should " + (rememberChecked ? "" : " not " ) + " be checked");
  }

  test("pickemail controller with allow_persistent and remember set to false", function() {
    testRemember(false, false);
  });

  test("pickemail controller with allow_persistent set to false and remember set to true", function() {
    testRemember(false, true);
  });

  test("pickemail controller with allow_persistent and remember set to true", function() {
    testRemember(true, true);
  });


  asyncTest("signIn saves email, remember status to storage when allow_persistent set to true", function() {
    storage.addEmail("testuser@testuser.com", {});
    storage.addEmail("testuser2@testuser.com", {});

    createController(true);

    $("input[type=radio]").eq(0).trigger("click");
    $("#remember").attr("checked", true);

    var assertion;

    register("email_chosen", function(msg, info) {
      equal(storage.site.get(testOrigin, "email"), "testuser2@testuser.com", "email saved correctly");
      equal(storage.site.get(testOrigin, "remember"), true, "remember saved correctly");
      ok(info.email, "email_chosen message triggered with email");
      start();
    });
    controller.signIn();
  });

  asyncTest("signIn saves email, but not remember status when allow_persistent set to false", function() {
    storage.addEmail("testuser@testuser.com", {});
    storage.addEmail("testuser2@testuser.com", {});
    storage.site.set(testOrigin, "remember", false);

    createController(false);

    $("input[type=radio]").eq(0).trigger("click");
    $("#remember").attr("checked", true);

    register("email_chosen", function(msg, info) {
      equal(storage.site.get(testOrigin, "email"), "testuser2@testuser.com", "email saved correctly");
      equal(storage.site.get(testOrigin, "remember"), false, "remember saved correctly");

      start();
    });
    controller.signIn();
  });
  
  test("can uncheck the persistence checkbox", function() {
    createController(true);
    
    $("#remember").attr("checked", true);
    $("label[for=remember]").trigger("click");

    equal($("#remember").is(":checked"), false, "checkbox properly unchecked");
  });

  asyncTest("addEmail triggers an 'add_email' message", function() {
    createController(false);

    register("add_email", function(msg, info) {
      ok(true, "add_email triggered");
      start();
    });
    controller.addEmail();
  });

  test("click on an email label - select corresponding radio button", function() {
    storage.addEmail("testuser@testuser.com", {});
    storage.addEmail("testuser2@testuser.com", {});

    createController(false);

    equal($("#testuser_testuser_com").is(":checked"), false, "radio button is not selected before click.");
    $("label[for=testuser_testuser_com]").trigger("click");

    equal($("#testuser_testuser_com").is(":checked"), true, "radio button is correctly selected");
  });

  test("click on the 'Always sign in...' label - check the checkbox", function() {
    createController(true);

    equal($("#remember").is(":checked"), false, "checkbox is not checked");
    $("label[for=remember]").trigger("click");

    equal($("#remember").is(":checked"), true, "checkbox is correctly checked");
  });

}());

