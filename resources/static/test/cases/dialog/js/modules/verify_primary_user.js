/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  var bid = BrowserID,
      controller,
      testHelpers = bid.TestHelpers,
      testElementExists = testHelpers.testElementExists,
      testElementNotExists = testHelpers.testElementDoesNotExist,
      xhr = bid.Mocks.xhr,
      WindowMock = bid.Mocks.WindowMock,
      win,
      storage = bid.Storage,
      mediator = bid.Mediator,
      modules = bid.Modules;

  function createController(options) {
    controller = modules.VerifyPrimaryUser.create();
    controller.start(options || {});
  }

  module("dialog/js/modules/verify_primary_user", {
    setup: function() {
      testHelpers.setup();
      win = new WindowMock();
      xhr.setContextInfo('auth_level', 'password');
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

  asyncTest("Render dialog", function() {
    // siteName and idpName are escaped when they come into the system. The
    // values do not need to be escaped again. See issue #3173
    var siteName = _.escape("a / b");
    var idpName = "testuser.com";

    xhr.useResult("primaryTransition");

    createController({
      email: 'registered@testuser.com',
      siteName: siteName,
      idpName: idpName,
      ready: function() {
        var copy = $('#upgrade_to_primary').html();
        ok(!!copy && copy.length > 0, "We have some copy");
        ok(copy.indexOf('redirect you to testuser.com') > -1,
            "idPName shows up");

        // If there is double escaping going on, the indexOf will all fail.
        equal(copy.indexOf(_.escape(siteName)), -1);
        start();
      }
    });
  });

  asyncTest("siteName and idpName are only escaped once", function() {
    xhr.useResult("primaryUnknown");

    // siteName and idpName are escaped when they come into the system. The
    // values do not need to be escaped again. See issue #3173
    var siteName = _.escape("a / b");
    var idpName = _.escape("idp / idp++");

    createController({
      siteName: siteName,
      idpName: idpName,
      window: win,
      add: false,
      email: "unregistered@testuser.com",
      ready: function ready() {
        var description = $(".description").html();
        // If there is double escaping going on, the indexOfs will all fail.
        equal(description.indexOf(_.escape(idpName)), -1);
        equal(description.indexOf(_.escape(siteName)), -1);
        equal($("#postVerify").html().indexOf(_.escape(siteName)), -1);
        start();
      }
    });

  });

  asyncTest("submit with `add: false` option opens a new tab with proper URL", function() {
    xhr.useResult("primaryUnknown");

    var messageTriggered = false;
    createController({
      window: win,
      add: false,
      email: "unregistered@testuser.com",
      ready: function ready() {
        mediator.subscribe("primary_user_authenticating", function() {
          messageTriggered = true;
        });

        // Also checking to make sure the NATIVE is stripped out.
        win.document.location.href = "sign_in";
        win.document.location.hash = "#NATIVE";

        controller.submit(function() {
          equal(win.document.location,
              "https://auth_url?email=unregistered%40testuser.com");
          equal(messageTriggered, true);
          // make sure the data used when returning from the primary is as
          // expected.
          var dataUsedOnReturnFromPrimary = storage.idpVerification.get();
          equal(dataUsedOnReturnFromPrimary['native'], true);
          equal(dataUsedOnReturnFromPrimary.add, false);
          equal(dataUsedOnReturnFromPrimary.email, "unregistered@testuser.com");

          start();
        });
      }
    });
  });

  asyncTest("submit with `add: true` option opens a new tab with proper URL", function() {

    xhr.useResult("primaryUnknown");
    createController({
      window: win,
      add: true,
      email: "unregistered@testuser.com",
      ready: function ready() {
        // Also checking to make sure the NATIVE is stripped out.
        win.document.location.href = "sign_in";
        win.document.location.hash = "#NATIVE";
        controller.submit(function() {
          equal(win.document.location,
              "https://auth_url?email=unregistered%40testuser.com");

          // make sure the data used when returning from the primary is as
          // expected.
          var dataUsedOnReturnFromPrimary = storage.idpVerification.get();
          equal(dataUsedOnReturnFromPrimary['native'], true);
          equal(dataUsedOnReturnFromPrimary.add, true);
          equal(dataUsedOnReturnFromPrimary.email, "unregistered@testuser.com");
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
      ready: function r() {
        testElementExists(".verifyWithPrimary");
        var text = $(".form_section .description").text();
        ok(text.indexOf("Persona lets you use your") !== -1, "shows first-time transition message");
        start();
      }
    });
  });

  asyncTest("transition_to_primary shows verify_primary_user dialog", function() {
    xhr.useResult("primaryTransition");
    createController({
      window: win,
      email: "registered@testuser.com",
      ready: function r() {
        testElementExists(".verifyWithPrimary");
        var text = $(".form_section .description").text();
        ok(text.indexOf("has been upgraded") !== -1);

        controller.submit(function() {
          equal(win.document.location,
              "https://auth_url?email=registered%40testuser.com");
          start();
        });
      }
    });
  });

  asyncTest("known_primary doesn't show verify_primary_user dialog", function() {
    xhr.useResult("primary");
    createController({
      window: win,
      email: "registered@testuser.com",
      ready: function r() {
        testElementNotExists(".verifyWithPrimary");
        start();
      }
    });
  });

}());
