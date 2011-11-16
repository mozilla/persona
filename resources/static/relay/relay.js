/*global Channel: true, errorOut: true */

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

  window.console = window.console || {
    log: function() {}
  };

  BrowserID.Relay = (function() {
    var channel = Channel,
        win = window;

    // captured method calls
    var METHODS = ["get"];
    var registeredMethods, pendingCall;

    function init(options) {
      registeredMethods = pendingCall = undefined;

      if(options.window) {
        win = options.window;
      }

      if(options.channel) {
        channel = options.channel;
      }
    }

    // try to forward the transaction, otherwise
    // stash it away for later. Assumes only one
    // transaction at a time for now.
    function forwardCall(methodCall) {
      // forwarding pending call?
      if (!methodCall) {
        methodCall = pendingCall;
        pendingCall = null;
      }

      // no call still?
      if (!methodCall)
        return;

      // ready to go?
      if (!registeredMethods) {
        // no, stash it for later
        pendingCall = methodCall;
        return;
      }

      // ok, we can make the call
      var method = methodCall.method;
      var transaction = methodCall.transaction;
      var origin = transaction.origin;
      var params = methodCall.params;

      // have the call?
      if (registeredMethods[method]) {
        registeredMethods[method](
          origin, params,
          function(result) {
            transaction.complete(result);
          }, function(error) {
            transaction.error(error, getVerboseMessage(error));
          }
        );
      }
    }
    
    function open() {
      var rpc = channel.build({
        window: win,
        origin: "*",
        scope: "mozid"
      });

      for (var i=0; i<METHODS.length; i++) {
        var method = METHODS[i];
        rpc.bind(method, function(trans, params) {
          trans.delayReturn(true);
          forwardCall({method: method, transaction: trans, params: params});
        });
      }
    }

    function registerClient(methods) {
      registeredMethods = methods;
      forwardCall();
    }

    function unregisterClient() {
      registeredMethods = null;
    }

    function getVerboseMessage(code) {
      var msgs = {
        "canceled": "user canceled selection",
        "notImplemented": "the user tried to invoke behavior that's not yet implemented",
        "serverError": "a technical problem was encountered while trying to communicate with BrowserID servers."
      };
      var msg = msgs[code];
      if (!msg) {
        alert("need verbose message for " + code);
        msg = "unknown error";
      }
      return msg;
    }
    
    return {
      /**
       * Initialize the relay. 
       * @method init
       * @param {object} [options] - options used to override window, channel 
       * for unit testing.
       */
      init: init,

      /**
       * Open the relay with the parent window.
       * @method open
       */
      open: open,

      /**
       * Register a client to use the relay
       * @method registerClient
       */
      registerClient: registerClient,
      unregisterClient: unregisterClient
    };
  }());

}());
