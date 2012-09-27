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
      testElementFocused = testHelpers.testElementFocused,
      testElementChecked = testHelpers.testElementChecked,
      testElementNotChecked = testHelpers.testElementNotChecked,
      register = bid.TestHelpers.register;

  module("dialog/js/modules/pick_email", {
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


  function createController() {
    controller = bid.Modules.PickEmail.create();
    controller.start({});
  }

  test("multiple emails with no email assocated with site - print emails in alphabetical order, select none", function() {
    storage.addEmail("third@testuser.com", {});
    storage.addEmail("second@testuser.com", {});
    storage.addEmail("first@testuser.com", {});

    createController();

    var inputs = $(".inputs input[type=radio]");
    equal(inputs.eq(0).val(), "first@testuser.com", "correct email for the first element");
    equal(inputs.eq(1).val(), "second@testuser.com", "correct email for the second element");
    equal(inputs.eq(2).val(), "third@testuser.com", "correct email for the third element");

    equal($("input[type=radio]:checked").length, 0, "if there is no email associated with the site, but there are multiple addresses, do not select an address");
    equal($("label.preselected").length, 0, "no item preselected");
    testElementFocused("input[type=radio]:eq(0)", "if there is no email associated with the site, but there are multiple addresses, focus the first email address");
  });

  test("email associated with site - check correct email", function() {
    storage.addEmail("testuser@testuser.com", {});
    storage.addEmail("testuser2@testuser.com", {});
    storage.site.set(testOrigin, "email", "testuser2@testuser.com");

    createController();

    var radioButton = $("input[type=radio]").eq(0);
    testElementChecked(radioButton, "the email address we specified is checked");
    testElementFocused(radioButton, "checked element is focused");

    var label = $("label[for=" + radioButton.attr("id") + "]");
    ok(label.hasClass("preselected"), "the label has the preselected class");
  });

  test("single email, no email associated with site - check first radio button", function() {
    storage.addEmail("testuser@testuser.com", {});

    createController();

    var radioButton = $("input[type=radio]").eq(0);
    testElementChecked(radioButton, "The lone email address is not checked");
    testElementFocused(radioButton, "the lone email address is still focused for keyboard navigation");

    var label = radioButton.parent();
    equal(label.hasClass("preselected"), false, "the label has no class");
  });

  asyncTest("signIn - trigger 'email_chosen message'", function() {
    storage.addEmail("testuser@testuser.com", {});
    storage.addEmail("testuser2@testuser.com", {});

    createController();

    // this should only be triggered once.  testHelpers.register checks this
    // for us.
    var assertion;
    register("email_chosen", function(msg, info) {
      ok(info.email, "email_chosen message triggered with email");
      start();
    });

    // trying to sign in without an email selected shows a tooltip.
    controller.signIn();
    testHelpers.testTooltipVisible();

    // trying to sign in with an email selected operates as expected.
    $("input[type=radio]").eq(0).trigger("click");
    controller.signIn();
  });

  asyncTest("addEmail triggers an 'add_email' message", function() {
    createController();

    register("add_email", function(msg, info) {
      ok(true, "add_email triggered");
      start();
    });
    controller.addEmail();
  });

  test("click on an email label and radio button - select corresponding radio button", function() {
    storage.addEmail("testuser2@testuser.com", {});
    storage.addEmail("testuser@testuser.com", {});

    createController();

    testElementNotChecked("#mail_1", "radio button is not selected before click.");

    // selects testuser@testuser.com
    $(".inputs label:eq(1)").trigger("click");
    testElementChecked("#email_1", "radio button is correctly selected after click");

    // selects testuser2@testuser.com
    $(".inputs label:eq(0)").trigger("click");
    testElementChecked("#email_0", "radio button is correctly selected after click");
  });

  test("click on an email label that contains a + - select corresponding radio button", function() {
    storage.addEmail("testuser+test0@testuser.com", {});
    storage.addEmail("testuser+test1@testuser.com", {});

    createController();

    testElementNotChecked("#email_1", "radio button is not selected before click.");

    // selects testuser+test1@testuser.com
    $(".inputs label:eq(1)").trigger("click");
    testElementChecked("#email_1", "radio button is correctly selected after click");

    // selects testuser+test0@testuser.com
    $(".inputs label:eq(0)").trigger("click");
    testElementChecked("#email_0", "radio button is correctly selected after click");
  });

  asyncTest("click on not me button - trigger notme message", function() {
    createController();

    register("notme", function(msg, info) {
      ok(true, "notme triggered");
      start();
    });

    $("#thisIsNotMe").click();
  });

}());

