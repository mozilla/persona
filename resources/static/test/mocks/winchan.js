/*jshint browser: true, forin: true, laxbreak: true */
/*global BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Mocks.WinChan = (function() {
  "use strict";

  function WinChan() { };

  WinChan.prototype = {
    open: function(params, callback) {
      this.params = params;
      this.oncomplete = callback;
      callback && callback(null, "yar");
    },

    onOpen: function() {
      return {
        detach: function() {}
      };
    }
  };

  return WinChan;

}());
