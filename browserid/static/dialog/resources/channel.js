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

/*global alert:true, setupNativeChannel:true, setupHTMLChannel:true, Channel:true */
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


var setupChannel = function(controller) {
  if (navigator.id && navigator.id.channel)
    setupNativeChannel(controller);
  else
    setupHTMLChannel(controller);
};

var setupNativeChannel = function(controller) {
  navigator.id.channel.registerController(controller);
};

var setupHTMLChannel = function(controller) {
  var origin = "http://localhost:10001";

  function onsuccess(rv) {
    var frameWindow = window.opener.frames['browserid_relay'];
    if(frameWindow.browserid_relay) {
      frameWindow.browserid_relay(rv, null);
    }
  }

  function onerror(error) {
    if(frameWindow.browserid_relay) {
      frameWindow.browserid_relay(null, error);
    }
  }

  controller.getVerifiedEmail(origin, onsuccess, onerror);
};
