/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
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

  asyncTest("initialization with #EMAIL=testuser@testuser.com", function() {
    winMock.location.hash = "#EMAIL=testuser@testuser.com";

    createController({
      ready: function() {
        mediator.subscribe("primary_user", function(msg, info) {
          equal(info.email, "testuser@testuser.com", "email_chosen with correct email");
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

