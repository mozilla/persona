/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      channel = bid.Channel,
      network = bid.Network,
      mediator = bid.Mediator,
      testHelpers = bid.TestHelpers,
      xhr = bid.Mocks.xhr,
      controller,
      el,
      winMock,
      navMock;

  function reset() {
  }

  function WinMock() {
    this.location.hash = "#1234";
  }

  WinMock.prototype = {
    // Oh so beautiful.
    opener: {
      frames: {
        1234: {
          BrowserID: {
            Relay: {
              registerClient: function() {
              },

              unregisterClient: function() {
              }
            }
          }
        }
      }
    },

    location: {
    },

    navigator: {},
  };

  function createController(config) {
    var config = $.extend({
      window: winMock
    }, config);

    controller = BrowserID.Modules.Dialog.create();
    controller.start(config);
  }

  module("controllers/dialog", {
    setup: function() {
      winMock = new WinMock();
      reset();
      testHelpers.setup();
    },

    teardown: function() {
      controller.destroy();
      reset();
      testHelpers.teardown();
    }
  });

  function checkNetworkError() {
    ok($("#error .contents").text().length, "contents have been written");
    ok($("#error #action").text().length, "action contents have been written");
    ok($("#error #network").text().length, "network contents have been written");
  }

  asyncTest("initialization with channel error", function() {
    // Set the hash so that the channel cannot be found.
    winMock.location.hash = "#1235";
    createController({
      ready: function() {
        ok($("#error .contents").text().length, "contents have been written");
        start();
      }
    });
  });

  asyncTest("initialization with add-on navigator.id.channel", function() {
    var ok_p = false;

    // expect registerController to be called.
    winMock.navigator.id = {
      channel : {
        registerController: function(controller) {
          ok_p = controller.getVerifiedEmail && controller.get;
        }
      }
    };

    createController({
      ready: function() {
        ok(ok_p, "registerController was not called with proper controller");
        start();
      }
    });
  });

  asyncTest("initialization with #NATIVE", function() {
    winMock.location.hash = "#NATIVE";

    createController({
      ready: function() {
        ok($("#error .contents").text().length == 0, "no error should be reported");
        start();
      }
    });
  });


  asyncTest("initialization with #INTERNAL", function() {
    winMock.location.hash = "#INTERNAL";

    createController({
      ready: function() {
        ok($("#error .contents").text().length == 0, "no error should be reported");
        start();
      }
    });
  });

  asyncTest("initialization with #CREATE_EMAIL=testuser@testuser.com - trigger start with correct params", function() {
    winMock.location.hash = "#CREATE_EMAIL=testuser@testuser.com";

    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          equal(info.type, "primary", "correct type");
          equal(info.email, "testuser@testuser.com", "email_chosen with correct email");
          equal(info.add, false, "add is not specified with CREATE_EMAIL option");
          start();
        });

        try {
          controller.get(testHelpers.testOrigin, {}, function() {}, function() {});
        }
        catch(e) {
          // do nothing, an exception will be thrown because no modules are
          // registered for the any services.
        }
      }
    });
  });

  asyncTest("initialization with #ADD_EMAIL=testuser@testuser.com - trigger start with correct params", function() {
    winMock.location.hash = "#ADD_EMAIL=testuser@testuser.com";

    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          equal(info.type, "primary", "correct type");
          equal(info.email, "testuser@testuser.com", "email_chosen with correct email");
          equal(info.add, true, "add is specified with ADD_EMAIL option");
          start();
        });

        try {
          controller.get(testHelpers.testOrigin, {}, function() {}, function() {});
        }
        catch(e) {
          // do nothing, an exception will be thrown because no modules are
          // registered for the any services.
        }
      }
    });
  });

  asyncTest("onWindowUnload", function() {
    createController({
      requiredEmail: "registered@testuser.com",
      ready: function() {
        var error;

        try {
          controller.onWindowUnload();
        }
        catch(e) {
          error = e;
        }

        equal(typeof error, "undefined", "unexpected error thrown when unloading window (" + error + ")");
        start();
      }
    });
  });


}());

