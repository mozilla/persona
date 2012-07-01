/*jshint browser: true, forin: true, laxbreak: true */
/*global BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Mocks.WindowMock = (function() {
  "use strict";

  function DocumentMock() {
    this.location = {
      href: document.location.href,
      hash: document.location.hash
    };
  }

  function WindowMock() {
    this.document = new DocumentMock();
    this.sessionStorage = {};
  }
  WindowMock.prototype = {
    open: function(url, name, options) {
      this.open_url = url;
    }
  };

  return WindowMock;

}());
