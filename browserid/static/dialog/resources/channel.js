/*jshint browsers:true, forin: true, laxbreak: true */
/*global alert:true, setupNativeChannel:true, setupIFrameChannel:true*/
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
  function getRelayID() {
    return window.location.href.slice(window.location.href.indexOf('#') + 1);
  }

  function getRelayName() {
    return "browserid_relay_" + getRelayID();
  }

  function getRelayWindow() {
    var frameWindow = window.opener.frames[getRelayName()];
    return frameWindow;
  }

  function registerWithRelayFrame(callback) {
    var frameWindow = getRelayWindow();
    if (frameWindow) {
      frameWindow['register_dialog'](callback);
    }
  }

  function getRPRelay() {
    var frameWindow = getRelayWindow();
    return frameWindow && frameWindow['browserid_relay'];
  }


  function errorOut(trans, code) {
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
    trans.error(code, getVerboseMessage(code));
    window.self.close();
  }


  window.setupChannel = function(controller) {
    if (navigator.id && navigator.id.channel)
      setupNativeChannel(controller);
    else
      setupIFrameChannel(controller);
  };

  var setupNativeChannel = function(controller) {
    navigator.id.channel.registerController(controller);
  };

  var setupIFrameChannel = function(controller) {
    // TODO - Add a check for whether the dialog was opened by another window
    // (has window.opener) as well as whether the relay function exists.
    // If these conditions are not met, then print an appropriate message.

    // get the relay here at the time the channel is setup before any navigation has
    // occured.  if we wait the window hash might change as a side effect to user
    // navigation, which would cause us to not find our parent window.
    // issue #295
    var relay = getRPRelay();
    
    function onsuccess(rv) {
      // Get the relay here so that we ensure that the calling window is still
      // open and we aren't causing a problem.
      if (relay) {
        relay(rv, null);
      }
    }

    function onerror(error) {
      if (relay) {
        relay(null, error);
      }
    }

    // The relay frame will give us the origin.
    registerWithRelayFrame(function(origin) {
      controller.getVerifiedEmail(origin, onsuccess, onerror);
    });

    window.location.hash = '';
  };

}());
