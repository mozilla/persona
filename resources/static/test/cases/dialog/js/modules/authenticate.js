/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      el = $("body"),
      bid = BrowserID,
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
      register = testHelpers.register,
      provisioning = bid.Mocks.Provisioning,
      AUTH_FORM_SELECTOR = "#authentication_form",
      CONTENTS_SELECTOR = "#formWrap .contents",
      EMAIL_SELECTOR = "#authentication_email",
      PASSWORD_SELECTOR = "#authentication_password",
      FORGOT_PASSWORD_SELECTOR = "#forgotPassword",
      BODY_SELECTOR = "body",
      AUTHENTICATION_LABEL = "#authentication_form label[for=authentication_email]",
      EMAIL_LABEL = "#authentication_form .label.email_state",
      TRANSITION_TO_SECONDARY_LABEL = "#authentication_form .label.transition_to_secondary",
      PASSWORD_LABEL = "#authentication_form .label.password_state",
      IDP_SELECTOR = "#authentication_form .authentication_idp_name",
      AUTHENTICATION_CLASS = "authentication";


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

  asyncTest("email declared in options - prefill address field", function() {
    controller.destroy();
    $(EMAIL_SELECTOR).val("");

    createController({ email: "registered@testuser.com",
      ready: function() {
        equal($(EMAIL_SELECTOR).val(), "registered@testuser.com", "email prefilled");
        equal($("input[type=password]").is(":visible"), false, "password is not shown");
        start();
      }
    });
  });

  asyncTest("known secondary email declared in options - show password field", function() {
    controller.destroy();
    $(EMAIL_SELECTOR).val("");
    createController({
      email: "registered@testuser.com",
      type: "secondary",
      state: "known",
      ready: function() {
        equal($(EMAIL_SELECTOR).val(), "registered@testuser.com", "email prefilled");
        equal($("input[type=password]").is(":visible"), true, "password is shown");
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

  asyncTest("checkEmail with email with leading/trailing whitespace, user not registered - 'new_user' message", function() {
    $(EMAIL_SELECTOR).val("    unregistered@testuser.com   ");
    xhr.useResult("unknown_secondary");

    testUserUnregistered();
  });

  asyncTest("checkEmail with normal email, user registered - 'enter_password' message", function() {
    $(EMAIL_SELECTOR).val("registered@testuser.com");
    xhr.useResult("known_secondary");

    register("enter_password", function() {
      equal($(AUTHENTICATION_LABEL).html(), $(PASSWORD_LABEL).html(), "enter password message shown");
      start();
    });

    controller.checkEmail();
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

  asyncTest("checkEmail with email that has IdP support - 'primary_user' message", function() {
    $(EMAIL_SELECTOR).val("unregistered@testuser.com");
    xhr.useResult("primary");

    register("primary_user", function(msg, info) {
      equal(info.email, "unregistered@testuser.com", "email correctly passed");
      equal(info.auth, "https://auth_url", "IdP authentication URL passed");
      equal(info.prov, "https://prov_url", "IdP provisioning URL passed");
      start();
    });

    controller.checkEmail();
  });

  asyncTest("checkEmail with secondary that used to be a primary", function() {
    $(EMAIL_SELECTOR).val("registered@testuser.com");
    xhr.useResult("secondaryTransition");

    register("enter_password", function() {
      equal($(AUTHENTICATION_LABEL).html(), $(TRANSITION_TO_SECONDARY_LABEL).html(), "transition message shown");
      start();
    });

    controller.checkEmail();
  });


  function testAuthenticated() {
    register("authenticated", function() {
      ok(true, "user authenticated as expected");
      start();
    });
    controller.authenticate();
  }

  asyncTest("normal authentication is kosher", function() {
    $(EMAIL_SELECTOR).val("registered@testuser.com");
    $(PASSWORD_SELECTOR).val("password");

    testAuthenticated();
  });

  asyncTest("leading/trailing whitespace on the username is stripped for authentication", function() {
    $(EMAIL_SELECTOR).val("    registered@testuser.com    ");
    $(PASSWORD_SELECTOR).val("password");

    testAuthenticated();
  });

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
    xhr.useResult("unknown_secondary");

    register("new_user", function(msg, info) {
      equal(info.email, "unregistered@testuser.com", "new_user with correct email triggered");
      start();
    });

    controller.createUser();
  });

  asyncTest("createUser with invalid email", function() {
    $(EMAIL_SELECTOR).val("unregistered");

    var handlerCalled = false;
    register("new_user", function(msg, info) {
      handlerCalled = true;
    });

    controller.createUser(function() {
      equal(handlerCalled, false, "bad jiji, new_user should not have been called with invalid email");
      start();
    });
  });


}());

