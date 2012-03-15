/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  window.BrowserID = window.BrowserID || {};

  // Define some constants.
  _.extend(window.BrowserID, {
    // always use 1024 DSA keys - see issue #1293
    KEY_LENGTH: 128
  });
}());
