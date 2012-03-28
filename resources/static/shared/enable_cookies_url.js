/*global BrowserID: true, gettext: true*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.EnableCookiesURL = (function(){
  "use strict";

  var bid = BrowserID,
      bs = bid.BrowserSupport;

  function getURL() {
    return bs.isIOS() ?
      "https://support.mozilla.org/kb/how-enable-cookies-iphone" :
      "http://support.mozilla.org/kb/Websites%20say%20cookies%20are%20blocked";
  }

  return {
    getURL: getURL
  };
}());
