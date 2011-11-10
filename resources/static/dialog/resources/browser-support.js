/*globals BrowserID: true */
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
BrowserID.BrowserSupport = (function() {
  var bid = BrowserID,
      win = window,
      nav = navigator,
      reason;

  // For unit testing
  function setTestEnv(newNav, newWindow) {
    nav = newNav;
    win = newWindow;
  }

  function getInternetExplorerVersion() {
    var rv = -1; // Return value assumes failure.
    if (nav.appName == 'Microsoft Internet Explorer') {
      var ua = nav.userAgent;
      var re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
      if (re.exec(ua) != null)
        rv = parseFloat(RegExp.$1);
    }

    return rv;
  }

  function checkIE() {
    var ieVersion = getInternetExplorerVersion(),
        ieNosupport = ieVersion > -1 && ieVersion < 9;

    if(ieNosupport) {
      return "IE_VERSION";
    }
  }

  function explicitNosupport() {
    return checkIE();
  }

  function checkLocalStorage() {
    var localStorage = 'localStorage' in win && win['localStorage'] !== null;
    if(!localStorage) {
      return "LOCALSTORAGE";
    }
  }

  function checkPostMessage() {
    if(!win.postMessage) {
      return "POSTMESSAGE";
    }
  }

  function isSupported() {
    reason = checkLocalStorage() || checkPostMessage() || explicitNosupport();

    return !reason;
  }

  function getNoSupportReason() {
    return reason;
  }

  return {
    /**
     * Set the test environment.
     * @method setTestEnv
     */
    setTestEnv: setTestEnv,
    /**
     * Check whether the current browser is supported
     * @method isSupported
     * @returns {boolean}
     */
    isSupported: isSupported,
    /**
     * Called after isSupported, if isSupported returns false.  Gets the reason 
     * why browser is not supported.
     * @method getNoSupportReason
     * @returns {string}
     */
    getNoSupportReason: getNoSupportReason
  };
  
}());

