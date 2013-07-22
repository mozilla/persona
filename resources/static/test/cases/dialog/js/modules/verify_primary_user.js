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

  function testRedirectToIdP(options, done) {
    var messageTriggered = false;
    mediator.subscribe("primary_user_authenticating", function() {
      messageTriggered = true;
    });

    options = _.extend({
      window: win,
      ready: function() {
        // was dialog redirected?
        equal(win.document.location,
            "https://auth_url?email=" + encodeURIComponent(options.email));

        // was the template written?
        testElementNotExists(".verifyWithPrimary");

        // was the rest of the dialog notified of intention to redirect?
        equal(messageTriggered, true);

        // was the appropriate data written to storage for when we return?
        var dataUsedOnReturnFromPrimary = storage.idpVerification.get();
        equal(dataUsedOnReturnFromPrimary.email, options.email);

        done && done();
      }
    }, options);

    createController(options);
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
    var siteName = "site name";
    var idpName = "testuser.com";

    xhr.useResult("primaryTransition");

    createController({
      email: 'registered@testuser.com',
      siteName: siteName,
      idpName: idpName,
      ready: function() {
        testHelpers.testElementExists("#upgrade_to_primary");
        testHelpers.testElementTextContains("#upgrade_to_primary",
            idpName);
        testHelpers.testElementTextContains("#upgrade_to_primary",
            siteName);
        start();
      }
    });
  });

  asyncTest("siteName and idpName are only escaped once", function() {
    xhr.useResult("primaryTransition");

    // siteName and idpName are escaped when they come into the system. The
    // values do not need to be escaped again. See issue #3173
    var siteName = _.escape("a / b");
    var idpName = _.escape("idp / idp++");

    createController({
      siteName: siteName,
      idpName: idpName,
      window: win,
      add: false,
      email: "registered@testuser.com",
      ready: function ready() {
        var description = $("#upgrade_to_primary").html();
        // If there is double escaping going on, the indexOfs will all fail.
        equal(description.indexOf(_.escape(idpName)), -1);
        equal(description.indexOf(_.escape(siteName)), -1);
        start();
      }
    });

  });

  asyncTest("create with primaryUnknown and `add: false` option redirects " +
      "to IdP without user interaction", function() {
    xhr.useResult("primaryUnknown");

    testRedirectToIdP({
      add: false,
      email: "unregistered@testuser.com"
    }, function() {
      // Dialog needs to know email was new.
      var dataUsedOnReturnFromPrimary = storage.idpVerification.get();
      equal(dataUsedOnReturnFromPrimary.add, false);
      start();
    });
  });

  asyncTest("create with primaryUnknown and `add: true` option redirects " +
      "to IdP without user interaction", function() {

    xhr.useResult("primaryUnknown");

    testRedirectToIdP({
      add: true,
      email: "unregistered@testuser.com"
    }, function () {
      var dataUsedOnReturnFromPrimary = storage.idpVerification.get();
      // Dialog needs to know email was an addition.
      equal(dataUsedOnReturnFromPrimary.add, true);
      start();
    });
  });


  asyncTest("known primary redirects directly to IdP without user interaction",
      function() {
    xhr.useResult("primary");
    testRedirectToIdP({email: "registered@testuser.com"}, start);
  });


  asyncTest("#NATIVE context is remembered when returning from primary",
      function() {
    xhr.useResult("primaryUnknown");

    // Check to make sure the native is saved in the
    // dataUsedOnReturnFromPrimary
    win.document.location.href = "sign_in";
    win.document.location.hash = "#NATIVE";

    testRedirectToIdP({
      add: false,
      email: "unregistered@testuser.com"
    }, function () {
      var dataUsedOnReturnFromPrimary = storage.idpVerification.get();
      equal(dataUsedOnReturnFromPrimary['native'], true);
      start();
    });
  });


  asyncTest("submit with no callback", function() {
    xhr.useResult("primaryTransition");
    createController({
      window: win,
      email: "registered@testuser.com",
      ready: function ready() {
        var error;
        try {
          controller.submit();
        }
        catch(e) {
          error = e;
        }

        testHelpers.testUndefined(error);
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
}());
