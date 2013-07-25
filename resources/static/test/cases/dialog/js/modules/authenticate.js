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
      network = bid.Network,
      xhr = bid.Mocks.xhr,
      emailRegistered = false,
      userCreated = true,
      mediator = bid.Mediator,
      registrations = [],
      testHelpers = bid.TestHelpers,
      testElementHasClass = testHelpers.testHasClass,
      testElementNotHasClass = testHelpers.testNotHasClass,
      testElementFocused = testHelpers.testElementFocused,
      testElementTextEquals = testHelpers.testElementTextEquals,
      register = testHelpers.register,
      provisioning = bid.Mocks.Provisioning,
      AUTH_FORM_SELECTOR = "#authentication_form",
      CONTENTS_SELECTOR = "#formWrap .contents",
      EMAIL_SELECTOR = "#authentication_email",
      PASSWORD_SELECTOR = "#authentication_password",
      FORGOT_PASSWORD_SELECTOR = ".forgotPassword",
      BODY_SELECTOR = "body",
      AUTHENTICATION_LABEL = "#authentication_form label[for=authentication_email]",
      EMAIL_LABEL = "#authentication_form .label.email_state",
      TRANSITION_TO_SECONDARY_LABEL = "#authentication_form .label.transition_to_secondary",
      PASSWORD_LABEL = "#authentication_form .label.password_state",
      IDP_SELECTOR = "#authentication_form .authentication_idp_name",
      AUTHENTICATION_CLASS = "authentication",
      CONTINUE_BUTTON_SELECTOR = ".continue";


  function reset() {
    emailRegistered = false;
    userCreated = true;
  }

  function createController(options) {
    options = options || {};
    controller = bid.Modules.Authenticate.create();
    controller.start(options);
  }

  module("dialog/js/modules/authenticate", {
    setup: function() {
      reset();
      $("input[type=password]").hide();
      testHelpers.setup();
      createController();
    },

    teardown: function() {
      if (controller) {
        try {
          controller.destroy();
        } catch(e) {
          // may already be destroyed from close inside of the controller.
        }
      }
      reset();
      testHelpers.teardown();
    }
  });

  function testAuthenticated(email, normalizedEmail) {
    var emailInfo;
    register("authenticated", function(msg, info) {
      emailInfo = info;
    });

    $(EMAIL_SELECTOR).val(email);

    controller.checkEmail(null, function() {
      $(PASSWORD_SELECTOR).val("password");
      controller.authenticate(function(info) {
        equal(emailInfo.email, normalizedEmail);
        start();
      });
    });
  }

  function testInvalidPassword(password) {
    register("authenticated", function() {
      ok(false, "authenticated should not be called");
    });

    $(EMAIL_SELECTOR).val("registered@testuser.com");

    controller.checkEmail(null, function() {
      $(PASSWORD_SELECTOR).val(password);
      controller.authenticate(start);
    });
  }


  asyncTest("authentication form initialized on startup, hidden on stop", function() {
    $(CONTENTS_SELECTOR).text("some contents that need to be removed");

    createController({
      ready: function() {
        // auth form visible when controller is ready
        testElementHasClass(BODY_SELECTOR, AUTHENTICATION_CLASS);

        equal($(CONTENTS_SELECTOR).text(), "", "normal form contents are removed");
        testElementFocused("#authentication_email", "email field is focused");

        // auth form not visible after stop;
        controller.stop();
        testElementNotHasClass(BODY_SELECTOR, AUTHENTICATION_CLASS);

        start();
      }
    });
  });

  asyncTest("warning sreens hidden on startup", function() {
    var classNames = ["waiting", "error", "delay"];

    // simulate the warning screens being shown in a module other than
    // authenticate.
    _.each(classNames, function(className) {
      $(BODY_SELECTOR).addClass(className);
    });

    // the authenticate module should hide the screens.
    createController({
      ready: function() {
        _.each(classNames, function(className) {
          testElementNotHasClass(BODY_SELECTOR, className);
        });
        start();
      }
    });
  });

  asyncTest("mutable email declared in options - email can be changed, " +
      "focus email field", function() {
    controller.destroy();
    $(EMAIL_SELECTOR).val("");

    createController({
      email: "registered@testuser.com",
      email_mutable: true,
      ready: function() {
        equal($(EMAIL_SELECTOR).val(), "registered@testuser.com", "email prefilled");
        testElementHasClass("body", "start");
        testElementNotHasClass("body", "returning");
        testElementNotHasClass("body", "emailImmutable");
        start();
      }
    });
  });

  asyncTest("immutable email declared in options - email cannot be changed, " +
      "straight to password field", function() {
    controller.destroy();
    $(EMAIL_SELECTOR).val("");

    createController({
      email: "registered@testuser.com",
      email_mutable: false,
      ready: function() {
        equal($(EMAIL_SELECTOR).val(), "registered@testuser.com", "email prefilled");
        testElementHasClass("body", "returning");
        testElementHasClass("body", "emailImmutable");
        start();
      }
    });
  });

  asyncTest("allowUnverified with an unverified email declared in options - show password field", function() {
    controller.destroy();
    $(EMAIL_SELECTOR).val("");
    createController({
      email: "unverified@testuser.com",
      type: "secondary",
      state: "unverified",
      allowUnverified: true,
      ready: function() {
        equal($(EMAIL_SELECTOR).val(), "unverified@testuser.com", "email prefilled");
        testElementHasClass("body", "returning");
        start();
      }
    });
  });

  function testUserUnregistered() {
    register("new_user", function(msg, info, rehydrate) {
      ok(info.email, "new_user triggered with info.email");
      // rehydration email used to go back to authentication controller if
      // the user cancels one of the next steps.
      ok(rehydrate.email, "new_user triggered with rehydrate.email");
      start();
    });

    controller.checkEmail();
  }

  asyncTest("checkEmail with unknown secondary email - 'new_user' message", function() {
    $(EMAIL_SELECTOR).val("unregistered@testuser.com");
    xhr.useResult("unknown_secondary");

    testUserUnregistered();
  });

  asyncTest("checkEmail with unknown email & forced issuer", function() {
    $(EMAIL_SELECTOR).val("unregistered@testuser.com");

    testHelpers.expectedMessage("new_fxaccount", {
      email: "unregistered@testuser.com"
    });

    user.setIssuer("fxos_issuer");
    xhr.useResult("unknown_secondary");
    controller.checkEmail(null, start);
  });

  asyncTest("checkEmail with email with leading/trailing whitespace, user not registered - 'new_user' message", function() {
    $(EMAIL_SELECTOR).val("    unregistered@testuser.com   ");
    xhr.useResult("unknown_secondary");

    testUserUnregistered();
  });

  asyncTest("checkEmail with normal email, user registered - 'enter_password' message", function() {
    $(EMAIL_SELECTOR).val("registered@testuser.com");
    xhr.useResult("known_secondary");

    register("enter_password", function() {
      testElementHasClass("body", "returning");
      start();
    });

    controller.checkEmail();
  });

  asyncTest("checkEmail with registered, unverified email, allowUnverified" +
      " set to true - 'enter_password' message", function() {
    controller.destroy();
    $(EMAIL_SELECTOR).val("");
    createController({
      allowUnverified: true,
      ready: function() {
        $(EMAIL_SELECTOR).val("registered@testuser.com");

        register("enter_password", function() {
          testElementHasClass("body", "returning");
          start();
        });

        user.setAllowUnverified(true);
        xhr.useResult("unverified");
        controller.checkEmail();
      }
    });
  });


  asyncTest("checkEmail leaves no traces - all inputs re-enabled when complete",
      function() {
    $(EMAIL_SELECTOR).val("registered@testuser.com");

    controller.checkEmail(null, function() {
      testElementNotHasClass("body", "submit_disabled");
      equal(typeof $("#authentication_email").attr("disabled"), "undefined");

      start();
    });
  });


  asyncTest("clear password if user changes email address", function() {
    xhr.useResult("known_secondary");
    $(EMAIL_SELECTOR).val("registered@testuser.com");

    var enterPasswordCount = 0;
    mediator.subscribe("enter_password", function() {
      // The first time the password is shown, change the email address.  The
      // second time the password is shown, make sure the password was cleared.

      if(enterPasswordCount === 0) {
        // simulate the user changing the email address.  This should clear the
        // password.
        $(PASSWORD_SELECTOR).val("password");
        $(EMAIL_SELECTOR).val("testuser@testuser.com");
        $(EMAIL_SELECTOR).keyup();
        controller.checkEmail();
      }
      else {
        equal($(PASSWORD_SELECTOR).val(), "", "password field was cleared");
        start();
      }

      enterPasswordCount++;
    });

    controller.checkEmail();
  });

  asyncTest("do not clear password if user selects an email address using autofill, then presses a key that does not change the address (CTRL-C for instance)", function() {
    xhr.useResult("known_secondary");

    // This test is for issue #406

    // First, see the staps after this handler.

    mediator.subscribe("enter_password", function() {
      // The user is now looking at the password field and they decide to copy
      // from the email field by hitting CTRL-C.
      //
      // Simulates the user hitting a key that does not change the
      // input.  The user should NOT go back to the "enter_email" state at this
      // point.
      var enterEmailCount = 0;
      mediator.subscribe("enter_email", function() {
        enterEmailCount++;
      });
      $(EMAIL_SELECTOR).keyup();

      equal(enterEmailCount, 0, "enter_email not called after submit if keyup did not change email field");
      start();
    });

    // Simulates the user selecting testuser@testuser.com from the
    // autocomplete menu.
    $(EMAIL_SELECTOR).val("registered@testuser.com");
    $(EMAIL_SELECTOR).change();

    // Simulate the user hitting the "next" button.  Once the address is
    // verified, the enter_password message will be triggered.
    controller.submit();
  });

  asyncTest("checkEmail with secondary that used to be a primary", function() {
    $(EMAIL_SELECTOR).val("registered@testuser.com");
    xhr.useResult("secondaryTransition");

    register("enter_password", function() {
      testElementHasClass("body", "transitionToSecondary");
      start();
    });

    controller.checkEmail();
  });


  asyncTest("checkEmail with secondary that used to be a primary - use incorrect case, make sure to use normalized email", function() {
    $(EMAIL_SELECTOR).val("REGISTERED@TESTUSER.COM");
    xhr.useResult("secondaryTransition");

    register("enter_password", function(msg, info) {
      testElementHasClass("body", "transitionToSecondary");
      equal(info.email, "registered@testuser.com");
      start();
    });

    controller.checkEmail();
  });


  asyncTest("normal authentication is kosher", function() {
    testAuthenticated("registered@testuser.com", "registered@testuser.com");
  });

  asyncTest("leading/trailing whitespace on the username is stripped for authentication", function() {
    testAuthenticated("    registered@testuser.com    ",
        "registered@testuser.com");
  });

  asyncTest("authentication with incorrect case uses normalized email", function() {
    testAuthenticated("REGISTERED@TESTUSER.COM", "registered@testuser.com");
  });

  testHelpers.testInvalidAuthenticationPassword(testInvalidPassword);

  asyncTest("forgotPassword - trigger forgot_password message", function() {
    $(EMAIL_SELECTOR).val("registered@testuser.com");

    register("forgot_password", function(msg, info) {
      equal(info.email, "registered@testuser.com", "forgot_password with correct email triggered");
      start();
    });

    controller.forgotPassword();
  });

  asyncTest("createUser with valid email", function() {
    $(EMAIL_SELECTOR).val("unregistered@testuser.com");

    testHelpers.expectedMessage("new_user", {
      email: "unregistered@testuser.com"
    });

    controller.createUser(start);
  });

  asyncTest("createUser with invalid email", function() {
    $(EMAIL_SELECTOR).val("unregistered");

    testHelpers.unexpectedMessage("new_user");

    controller.createUser(start);
  });

  asyncTest("createFxAccount with valid email", function() {
    $(EMAIL_SELECTOR).val("unregistered@testuser.com");

    testHelpers.expectedMessage("new_fxaccount", {
      email: "unregistered@testuser.com"
    });

    controller.createFxAccount(start);
  });

  asyncTest("createFxAccount with invalid email", function() {
    $(EMAIL_SELECTOR).val("unregistered");

    testHelpers.unexpectedMessage("new_fxaccount");

    controller.createFxAccount(start);
  });

  test("emailChange - submit button disabled if there is no input",
      function() {
    // start off with nothing
    $(EMAIL_SELECTOR).val("");
    controller.emailChange();
    ok($(CONTINUE_BUTTON_SELECTOR).attr("disabled"));

    // type a char
    $(EMAIL_SELECTOR).val("t");
    controller.emailChange();
    ok( ! $(CONTINUE_BUTTON_SELECTOR).attr("disabled"));

    // delete the char.
    $(EMAIL_SELECTOR).val("");
    controller.emailChange();
    ok($(CONTINUE_BUTTON_SELECTOR).attr("disabled"));
  });
}());

