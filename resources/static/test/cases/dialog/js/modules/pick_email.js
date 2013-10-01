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
      xhr = bid.Mocks.xhr,
      testElementFocused = testHelpers.testElementFocused,
      testElementChecked = testHelpers.testElementChecked,
      testElementNotChecked = testHelpers.testElementNotChecked,
      register = bid.TestHelpers.register;

  function testEmailSelected(email, message) {
    createController();
    register(message, function(msg, info) {
      equal(info.email, email, "email_chosen message triggered with email");
      start();
    });

    $("input[type=radio]").eq(0).trigger("click");
    controller.signIn();
  }


  function testLabelForRadioButtonHasSelectedClass(radioButton, msg) {
    // label must also have the "selected" class
    var id = $(radioButton).attr("id");
    ok($("label[for=" + id + "]").hasClass("selected"));
  }

  module("dialog/js/modules/pick_email", {
    setup: function() {
      testHelpers.setup();
      xhr.setContextInfo("auth_level", "password");
      xhr.setContextInfo("userid", 1);
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
    options = _.extend({
      origin: "https://testuser.com"
    }, options);

    var rpInfo = bid.Models.RpInfo.create(options);
    options.rpInfo = rpInfo;

    controller = bid.Modules.PickEmail.create();
    controller.start(options || {});
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

  test("email associated with site, no emailHint passed - preselect last used email", function() {
    storage.addEmail("testuser@testuser.com", {});
    storage.addEmail("testuser2@testuser.com", {});
    storage.site.set(testOrigin, "email", "testuser2@testuser.com");

    createController();

    var radioButton = $("input[type=radio]").eq(0);
    testElementChecked(radioButton);
    testElementFocused(radioButton);
    testLabelForRadioButtonHasSelectedClass(radioButton);

    var label = $("label[for=" + radioButton.attr("id") + "]");
    ok(label.hasClass("preselected"));
  });

  test("email associated with site, email that user owns specified in emailHint - " +
          "select email from emailHint", function() {
    storage.addEmail("testuser@testuser.com", {});
    storage.addEmail("testuser2@testuser.com", {});
    storage.site.set(testOrigin, "email", "testuser2@testuser.com");

    createController({
      emailHint: "testuser@testuser.com"
    });

    var radioButton = $("input[type=radio]").eq(1);
    testElementChecked(radioButton);
    testElementFocused(radioButton);
    testLabelForRadioButtonHasSelectedClass(radioButton);

    var label = $("label[for=" + radioButton.attr("id") + "]");
    ok(label.hasClass("preselected"));
  });

  test("email associated with site, email that user does not own specified in emailHint - " +
          "select last used email", function() {
    storage.addEmail("testuser@testuser.com", {});
    storage.addEmail("testuser2@testuser.com", {});
    storage.site.set(testOrigin, "email", "testuser2@testuser.com");

    createController({
      emailHint: "not_owned@testuser.com"
    });

    var radioButton = $("input[type=radio]").eq(0);
    testElementChecked(radioButton);
    testElementFocused(radioButton);
    testLabelForRadioButtonHasSelectedClass(radioButton);

    var label = $("label[for=" + radioButton.attr("id") + "]");
    ok(label.hasClass("preselected"));
  });


  test("single email, no email associated with site, no hint passed - check first radio button", function() {
    storage.addEmail("testuser@testuser.com", {});

    createController();

    var radioButton = $("input[type=radio]").eq(0);
    testElementChecked(radioButton, "The lone email address is not checked");
    testElementFocused(radioButton, "the lone email address is still focused for keyboard navigation");

    var label = radioButton.parent();
    equal(label.hasClass("preselected"), false, "the label has no class");
  });

  test("signIn with without selecting an address shows a tooltip", function() {
    storage.addEmail("testuser@testuser.com");
    storage.addEmail("testuser2@testuser.com", {cert: 'sdlkjfsdfj'});

    createController();

    // trying to sign in without an email selected shows a tooltip.
    controller.signIn();
    testHelpers.testTooltipVisible();
  });

  asyncTest("signIn with email selected - trigger 'email_chosen message'", function() {
    storage.addEmail("testuser@testuser.com", {cert: 'sdlkjfsdfj'});

    testEmailSelected("testuser@testuser.com", "email_chosen");
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

    testElementNotChecked("#email_1", "radio button is not selected before click.");

    // selects testuser@testuser.com
    $(".inputs label:eq(1)").trigger("click");
    testElementChecked("#email_1", "radio button is correctly selected after click");
    testLabelForRadioButtonHasSelectedClass("#email_1");

    // selects testuser2@testuser.com
    $(".inputs label:eq(0)").trigger("click");
    testElementChecked("#email_0", "radio button is correctly selected after click");
    testLabelForRadioButtonHasSelectedClass("#email_0");
  });

  test("click on an email label that contains a + - select corresponding radio button", function() {
    storage.addEmail("testuser+test0@testuser.com", {});
    storage.addEmail("testuser+test1@testuser.com", {});

    createController();

    testElementNotChecked("#email_1", "radio button is not selected before click.");

    // selects testuser+test1@testuser.com
    $(".inputs label:eq(1)").trigger("click");
    testElementChecked("#email_1", "radio button is correctly selected after click");
    testLabelForRadioButtonHasSelectedClass("#email_1");

    // selects testuser+test0@testuser.com
    $(".inputs label:eq(0)").trigger("click");
    testElementChecked("#email_0", "radio button is correctly selected after click");
    testLabelForRadioButtonHasSelectedClass("#email_0");
  });

  asyncTest("click on not me button - trigger notme message", function() {
    createController();

    register("notme", function(msg, info) {
      ok(true, "notme triggered");
      start();
    });

    $(".thisIsNotMe:eq(0)").click();
  });

  test("make sure RP tos/pp agreements are written to DOM", function() {
    createController({
      privacyPolicy: "https://testuser.com/pp.html",
      termsOfService: "https://testuser.com/tos.html",
      siteName: "TestUser.com",
      hostname: "testuser.com"
    });

    ok($(".tospp.isMobile").length);
  });

}());

