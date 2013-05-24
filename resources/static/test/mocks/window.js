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

  function WindowMock(options) {
    options = options || {};

    this.document = new DocumentMock();
    if (options.href) {
      this.document.location.href = options.href;
    }

    if (options.hash) {
      this.document.location.hash = options.hash;
    }

    this.sessionStorage = {};

    this.suppressOpen = options.suppressOpen || false;
  }

  WindowMock.prototype = {
    open: function(url, name, options) {
      if (this.suppressOpen) return;

      this.open_url = url;

      return new WindowMock({
        suppressOpen: this.suppressOpen,
        href: url
      });
    }
  };

  return WindowMock;

}());
