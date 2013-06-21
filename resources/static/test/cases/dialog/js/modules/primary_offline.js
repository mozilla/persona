/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      testHelpers = bid.TestHelpers,
      testElementTextContains = testHelpers.testElementTextContains;

  module("dialog/js/modules/primary_offline", {
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


  function createController(config) {
    controller = bid.Modules.PrimaryOffline.create();
    config = config || {};
    controller.start(config);
  }

  test("starting the controller without email throws exception", function() {
    var error;
    try {
      createController({});
    }
    catch(e) {
      error = e;
    }
    equal(error.message, "missing config option: email", "correct error message printed");
  });

  test("start controller idp that is not responding - display offline screen", function() {
    createController({
      email: "unregistered@testuser.com"
    });
    testElementTextContains("#primary_offline",
        'testuser.com is not responding', "Copy includes idpName");
  });

  asyncTest("user pressing cancel resets address cache", function() {
    createController({
      email: "testuser@testuser.com"
    });

    // primary starts offline
    xhr.useResult("primaryOffline");
    user.addressInfo("testuser@testuser.com", function(info) {
        testHelpers.testObjectValuesEqual(info, {
          email: "testuser@testuser.com",
          type: "primary",
          state: "offline"
        });

        // user cancels dialog, which should reset cache.
        controller.cancel();

        // primary comes back online
        xhr.useResult("primary");
        user.addressInfo("testuser@testuser.com", function(info) {

          // cache has indeed been updated.
          testHelpers.testObjectValuesEqual(info, {
            email: "testuser@testuser.com",
            type: "primary",
            state: "known"
          });
          xhr.useResult("primary");

          start();
        }, testHelpers.unexpectedFailure);
      }, testHelpers.unexpectedFailure);
  });

}());

