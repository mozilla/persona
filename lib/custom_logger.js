/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Enhances connect logger middleware - custom formats. See lib/configuration for usage.
 *
 * Note: No exports, ya I feel dirty too.
 */
var logger = require('express').logger;

logger.format('default_bid',
    ':remote-addr - - :date-millis ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"');

logger.format('dev_bid', ':date-millis :method :url :status :response-time ms');

logger.token('date-millis', function (req) {
  var d = req._startTime,
      t = '' + d.getTime();
  return '[' + d.toUTCString() + ']@' + t.slice(-4);
});