/*jshint browser: true*/
/*globals  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      testHelpers = bid.TestHelpers;

  module("dialog/js/modules/primary_user_not_provisioned", {
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
      testHelpers.setup();
    }
  });


  function createController(config) {
    controller = bid.Modules.PrimaryUserNotProvisioned.create();
    config = config || {};
    controller.start(config);
  }

  function testMissingOption(options, missingName) {
    var error;

    try {
      createController(options);
    }
    catch(e) {
      error = e;
    }

    equal(error.message, "missing config option: " + missingName);
  }

  test("starting the controller without email throws exception", function() {
    testMissingOption({
      idpName: "IdP"
    }, "email");
  });

  test("starting the controller without idpName throws exception", function() {
    testMissingOption({
      email: "testuser@tesutser.com"
    }, "idpName");
  });

  asyncTest("all options passed", function() {
    createController({
      email: "testuser@testuser.com",
      idpName: "testuser.com",
      ready: function() {
        testHelpers.testElementExists("#primary_user_not_verified");
        start();
      }
    });
  });

  asyncTest("use idpHost over idpName", function() {
    var delegatedHost = 'login.mozilla.org';
    createController({
      email: 'testuser@mozilla.com',
      idpName: 'mozilla.com',
      idpHost: delegatedHost,
      ready: function() {
        var text = jQuery('#primary_user_not_verified + p').text();
        ok(text.indexOf(delegatedHost) > -1, 'delegated domain is in message');
        start();
      }
    });
  });


}());

