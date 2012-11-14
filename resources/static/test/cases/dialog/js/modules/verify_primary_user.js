/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      controller,
      el,
      testHelpers = bid.TestHelpers,
      testElementExists = testHelpers.testElementExists,
      testElementNotExists = testHelpers.testElementDoesNotExist,
      xhr = bid.Mocks.xhr,
      WindowMock = bid.Mocks.WindowMock,
      win,
      mediator = bid.Mediator;

  function createController(config) {
    controller = BrowserID.Modules.VerifyPrimaryUser.create();
    controller.start(config);
  }

  module("controllers/verify_primary_user", {
    setup: function() {
      testHelpers.setup();
      win = new WindowMock();
      xhr.setContextInfo('auth_level', 'password');
    },

    teardown: function() {
      if(controller) {
        controller.destroy();
      }
      testHelpers.teardown();
    }
  });

  asyncTest("personaTOSPP true, requiredEmail: true - show TOS/PP", function() {
    createController({
      window: win,
      add: false,
      email: "unregistered@testuser.com",
      auth_url: "http://testuser.com/sign_in",
      requiredEmail: true,
      personaTOSPP: false,
      ready: function ready() {
        testElementNotExists("#persona_tospp");
        start();
      }
    });

  });

  asyncTest("personaTOSPP true, requiredEmail: false - show TOS/PP", function() {
    createController({
      window: win,
      add: false,
      email: "unregistered@testuser.com",
      auth_url: "http://testuser.com/sign_in",
      requiredEmail: false,
      personaTOSPP: false,
      ready: function ready() {
        testElementNotExists("#persona_tospp");
        start();
      }
    });

  });

  asyncTest("submit with `add: false` option opens a new tab with proper URL (updated for sessionStorage)", function() {

    xhr.useResult("primaryUnknown");

    var messageTriggered = false;
    createController({
      window: win,
      add: false,
      email: "unregistered@testuser.com",
      auth_url: "http://testuser.com/sign_in",
      personaTOSPP: true,
      ready: function ready() {
        testElementExists("#persona_tospp");

        mediator.subscribe("primary_user_authenticating", function() {
          messageTriggered = true;
        });

        // Also checking to make sure the NATIVE is stripped out.
        win.document.location.href = "sign_in";
        win.document.location.hash = "#NATIVE";

        controller.submit(function() {
          equal(win.document.location, "http://testuser.com/sign_in?email=unregistered%40testuser.com");
          equal(messageTriggered, true, "primary_user_authenticating triggered");
          start();
        });
      }
    });
  });

  asyncTest("submit with `add: true` option opens a new tab with proper URL (updated for sessionStorage)", function() {

    xhr.useResult("primaryUnknown");
    createController({
      window: win,
      add: true,
      email: "unregistered@testuser.com",
      auth_url: "http://testuser.com/sign_in",
      personaTOSPP: true,
      ready: function ready() {
        testElementExists("#persona_tospp");

        // Also checking to make sure the NATIVE is stripped out.
        win.document.location.href = "sign_in";
        win.document.location.hash = "#NATIVE";

        controller.submit(function() {
          equal(win.document.location, "http://testuser.com/sign_in?email=unregistered%40testuser.com");
          start();
        });
      }
    });

    

  });

  asyncTest("submit with no callback", function() {
    createController({
      window: win,
      add: true,
      email: "unregistered@testuser.com",
      auth_url: "http://testuser.com/sign_in",
      ready: function ready() {
        var error;
        try {
          controller.submit();
        }
        catch(e) {
          error = e;
        }

        equal(typeof error, "undefined", "error is undefined");
        start();
      }
    });

  });

  asyncTest("cancel triggers the cancel_state", function() {
    createController({
      window: win,
      add: true,
      email: "unregistered@testuser.com",
      auth_url: "http://testuser.com/sign_in",
      ready: function ready() {
        testHelpers.register("cancel_state");

        controller.cancel(function() {
          equal(testHelpers.isTriggered("cancel_state"), true, "cancel_state is triggered");
          start();
        });
      }
    });
  });

  asyncTest("unknown_primary shows verify_primary_user dialog", function() {
    xhr.useResult("primary");

    createController({
      window: win,
      email: "unregistered@testuser.com",
      auth_url: "http://testuser.com/sign_in",
      ready: function r() {
        testElementExists("#verifyWithPrimary");
        start();
      }
    });
  });

  asyncTest("transition_to_primary shows verify_primary_user dialog", function() {
    xhr.useResult("primaryTransition");

    createController({
      window: win,
      email: "registered@testuser.com",
      auth_url: "http://testuser.com/sign_in",
      ready: function r() {
        testElementExists("#verifyWithPrimary");
        start();
      }
    });
  });
  
  asyncTest("known_primary doesn't show verify_primary_user dialog", function() {
    xhr.useResult("primary");

    createController({
      window: win,
      email: "registered@testuser.com",
      auth_url: "http://testuser.com/sign_in",
      ready: function r() {
        testElementNotExists("#verifyWithPrimary");
        start();
      }
    });
  });

  asyncTest("submit on transition calls complete_transition", function() {
    xhr.useResult("primaryTransition");

    createController({
      window: win,
      email: "registered@testuser.com",
      auth_url: "http://testuser.com/sign_in",
      ready: function r() {

        console.log('merp');
        controller.submit(function s() {
          var req = xhr.getLastRequest();
          equal(req.url, '/wsapi/complete_transition', "complete_transition request sent");
          start();
        });
      }
    });
  });

}());

