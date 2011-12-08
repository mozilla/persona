/*jshint browsers:true, forin: true, laxbreak: true */
/*global BrowserID: true*/
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

// The way this works, when the dialog is opened from a web page, it opens
// the window with a #host=<requesting_host_name> parameter in its URL.
// window.setupChannel is called automatically when the dialog is opened. We
// assume that navigator.id.getVerifiedEmail was the function called, we will
// keep this assumption until we start experimenting.  Since IE has some
// serious problems iwth postMessage from a window to a child window, we are now
// communicating not directly with the calling window, but with an iframe
// on the same domain as us that we place into the calling window.  We use a
// function within this iframe to relay messages back to the calling window.
// We do so by searching for the frame within the calling window, and then
// getting a reference to the proxy function.  When getVerifiedEmail is
// complete, it calls the proxy function in the iframe, which then sends a
// message back to the calling window.



(function() {
  var win = window,
      nav = navigator,
      onCompleteCallback,
      _relayName,
      _relayWindow = null;

  function getRelayName() {
    var name = win.location.hash.substring(1);
    win.location.hash = "";
    if (name.length > 1)
      return name;
    else
      return null;
  }

  function getRelayWindow() {
    if (!_relayWindow) {
      _relayWindow = win.opener.frames[_relayName];
    }
    return _relayWindow;
  }

  function setupNativeChannel(controller) {
    nav.id.channel.registerController(controller);
  }

  function setupIFrameChannel(controller) {
    // TODO - Add a check for whether the dialog was opened by another window
    // (has window.opener) as well as whether the relay function exists.
    // If these conditions are not met, then print an appropriate message.
    _relayName = getRelayName();

    // If the relay name is NATIVE, that means do nothing because the
    // channel will be set up by the dialog implementer.
    if(_relayName === "NATIVE") {
      // In a native channel, do nothing.
    }
    else {
      var REGISTERED_METHODS = {
        'get': function(origin, params, onsuccess, onerror) {
          // check for old controller methods
          // FIXME KILL THIS SOON
          if (controller.get) {
            return controller.get(origin, params, onsuccess, onerror);
          } else {
            return controller.getVerifiedEmail(origin, onsuccess, onerror);
          }
        }
      };

      // The relay frame will give us the origin and a function to call when
      // dialog processing is complete.
      var frameWindow = getRelayWindow();

      if (frameWindow) {
        frameWindow.BrowserID.Relay.registerClient(REGISTERED_METHODS);
      }
      else {
        throw "relay frame not found";
      }
    }
  }

  function open(controller) {
    if (nav.id && nav.id.channel)
      setupNativeChannel(controller);
    else
      setupIFrameChannel(controller);
  }

  function close() {
    var frameWindow = getRelayWindow();

    if (frameWindow) {
      frameWindow.BrowserID.Relay.unregisterClient();
      _relayWindow = null;
    }
    else {
      throw "relay frame not found";
    }
  }

  function init(options) {
    onCompleteCallback = undefined;

    if(options.navigator) {
      nav = navigator;
    }

    if(options.window) {
      win = options.window;
    }
  }


  if(window.BrowserID) {
    BrowserID.Channel = {
      /**
       * Used to intialize the channel, mostly for unit testing to override
       * window and navigator.
       * @method init
       */
      init: init,

      /**
       * Open the channel.
       * @method open
       * @param {object} options - contains:
       * *   options.getVerifiedEmail {function} - function to /get
       */
      open: open,

      /**
       * Close the channel
       */
      close: close
    };
  }

  /**
   * This is here as a legacy API for addons/etc that are depending on
   * window.setupChannel;
   */
  window.setupChannel = open;
  window.teardownChannel = close;
}());
