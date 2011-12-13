/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
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

  var channel = BrowserID.Channel,
      winMock,
      navMock = { id: {} };

  // Mock in the window object as well as the frame relay
  var WinMock = function() {
    this.location.href = "browserid.org/sign_in#1234";
    this.location.hash = "#1234";
  }
  WinMock.prototype = {
    location: {},
    opener: {
      frames: {
        "1234": {
          BrowserID: {
            Relay: {
              registerClient: function(methods) {
                // mock of the registerClient function in the BrowserID.Channel.
                methods["get"]("foo.com", {}, function onComplete(success) {
                  WinMock.success = success;
                }, function onerror(error) {
                  WinMock.error = error;
                });
              },
              unregisterClient: function() {
              }
            }
          }
        }
      }
    }
  };

  module("resources/channel", {
    setup: function() {
      winMock = new WinMock();
      channel.init({
        window: winMock,
        navigator: navMock
      });
    },

    teardown: function() {
      if(channel) {
        try {
          channel.close();
        } catch(e) {
          if(e.toString() !== "relay frame not found") {
            // re-throw if the error is other than expected.
            throw e;
          }
        }

        channel.init({
          window: window,
          navigator: navigator
        });
      }
    }
  });

  test("window.setupChannel exists for legacy uses", function() {
    ok(typeof window.setupChannel, "function", "window.setupChannel exists for legacy uses");
  });

  asyncTest("IFRAME channel with assertion", function() {
    channel.open({
      getVerifiedEmail: function(origin, onsuccess, onerror) {
        onsuccess("assertion");
        equal(WinMock.success, "assertion", "assertion made it to the relay");
        start();
      }
    });
  });

  asyncTest("IFRAME channel with null assertion", function() {
    channel.open({
      getVerifiedEmail: function(origin, onsuccess, onerror) {
        onsuccess(null);
        strictEqual(WinMock.success, null, "null assertion made it to the relay");
        start();
      }
    });
  });

  asyncTest("IFRAME channel relaying error", function() {
    channel.open({
      getVerifiedEmail: function(origin, onsuccess, onerror) {
        onerror("error");
        strictEqual(WinMock.error, "error", "error made it to the relay");
        start();
      }
    });
  });

  test("IFRAME channel with #NATIVE channel specified", function() {
    winMock.location.hash = "#NATIVE";

    channel.open({
      getVerifiedEmail: function(origin, onsuccess, onerror) {
        ok(false, "getVerifiedEmail should not be called with a native channel");
      }
    });
  });

  asyncTest("IFRAME channel with error on open", function() {
    delete winMock.opener.frames['1234'];

    // Do this manually so we can test if getVerifiedEmail gets called.
    try {
      channel.open({
        getVerifiedEmail: function(origin, onsuccess, onerror) {
          ok(false, "getVerifiedEmail should never be called on channel error");
          start();
        }
      });
    } catch(e) {
      equal(e.toString(), "relay frame not found", "exception caught when trying to open channel that does not exist");
      start();
    }
  });

  test("close on a channel that has not been opened expects no errors", function() {
    var error;

    try {
      channel.close();
    }
    catch(e) {
      error = e;
    }

    equal(typeof error, "undefined", "unexpected error when closing channel (" + error + ")");
  });

}());

