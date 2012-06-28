/*globals BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
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

  function isIOS() {
    var ua = nav.userAgent;
    return ua.indexOf("like Mac OS X") > -1;
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
    getNoSupportReason: getNoSupportReason,
    /**
     * IE version surfaced for crypto optimizations
     */
    getInternetExplorerVersion: getInternetExplorerVersion,
    /**
     * Check to see whether user is using iOS
     * @method isIOS
     */
    isIOS: isIOS
  };

}());

