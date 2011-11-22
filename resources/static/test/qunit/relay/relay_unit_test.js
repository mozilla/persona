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

  var winMock = {},
      relay = BrowserID.Relay;

  var channelMock = {
    build: function(options) {
      this.options = options;

      channelMock.bindMessage = channelMock.cb = channelMock.status =
        channelMock.errorCode = channelMock.verboseError = undefined;

      return {
        bind: function(message, cb) {
          channelMock.bindMessage = message;
          channelMock.cb = cb;
        }
      }
    },

    // Mock in the receiving of the RPC call from the RP.
    receiveGet: function() {
      // cb is the mock callback that is passed to Channel.bind
      channelMock.cb({
        origin: "Origin",
        delayReturn: function() {},
        complete: function(status) {
          channelMock.status = status;
        },
        error: function(code, verboseMessage) {
          channelMock.errorCode = code;
          channelMock.verboseError = verboseMessage;
        }
      });
    }

  };


  module("relay/relay", {
    setup: function() {
      relay.init({
        window: winMock,
        channel: channelMock
      });
    },
    teardown: function() {
      relay.init({
        window: window.parent,
        channel: Channel
      });
    }
  });

  test("Can open the relay, happy case", function() {
    relay.open();

    /**
     * Check to make sure channel build is correct
     */
    equal(channelMock.options.window, winMock, "opening to the correct window");
    equal(channelMock.options.origin, "*", "accept messages from anybody");
    equal(channelMock.options.scope, "mozid", "mozid namespace");

    /**
     * Check to make sure the correct message is bound
     */
    equal(channelMock.bindMessage, "get", "bound to get");
  });

  asyncTest("channel.get before registerDialog", function() {
    relay.open();

    channelMock.receiveGet();

    relay.registerClient({'get': function(origin, params, completeCB) {
      equal(origin, "Origin", "Origin set correctly");
      equal(typeof completeCB, "function", "A completion callback is specified");

      start();
    }});
  });

  asyncTest("registerDialog before channel.getVerifiedEmail", function() {
    relay.open();

    relay.registerClient({'get': function(origin, params, completeCB) {
      equal(origin, "Origin", "Origin set correctly");
      equal(typeof completeCB, "function", "A completion callback is specified");

      start();
    }});

    channelMock.receiveGet();
  });

  asyncTest("calling the completeCB with assertion", function() {
    relay.open();

    channelMock.receiveGet();

    relay.registerClient({'get': function(origin, params, completeCB) {
      completeCB("assertion", null);
      equal(channelMock.status, "assertion", "channel gets the correct assertion");
      start();
    }});
  });


  asyncTest("calling the completeCB with null assertion", function() {
    relay.open();

    channelMock.receiveGet();

    relay.registerClient({'get': function(origin, params, completeCB) {
      completeCB(null, null);
      strictEqual(channelMock.status, null, "channel gets the null assertion");
      start();
    }});
  });

  asyncTest("calling the onerror callback", function() {
    relay.open();

    channelMock.receiveGet();

    relay.registerClient({'get': function(origin, params, onsuccess, onerror) {
      onerror("canceled");

      equal(channelMock.errorCode, "canceled", "error callback called with error code");
      ok(channelMock.verboseError, "verbose error code set");

      start();
    }});
  });
}());
