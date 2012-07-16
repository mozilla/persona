/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  window.BrowserID = window.BrowserID || {};

  // Define some constants.
  _.extend(window.BrowserID, {
    // always use 1024/160 DSA keys - see issue #1293
    // this used to be called keysize 128, but that made
    // no sense since no component of this is 128 bits
    // so making this 160 as per DSA 1024/160
    // EXCEPT, for backwards compatibility this is still 128 for now
    KEY_LENGTH: 128,

    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MAX_LENGTH: 80

  });
}());
