/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Metrics middleware that reports when the signin dialog is opened.
 */

const logger = require("../logging").logger;
const urlparse = require('urlparse');


// utility function to log a bunch of stuff at user entry point
module.exports = function(req, res, next) {
  if (req.url === '/sign_in') userEntry(req);
  next();
};

function userEntry(req) {
  var ipAddress = req.connection.remoteAddress;
  if (req.headers['x-real-ip']) ipAddress = req.headers['x-real-ip'];

  var referer = null;
  try {
    // don't log more than we need
    referer = urlparse(req.headers.referer).originOnly().toString();
  } catch(e) {
    // ignore malformed referrers.  just log null
  }

  logger.info('signin', {
    browser: req.headers['user-agent'],
    rp: referer,
    // IP address (this probably needs to be replaced with the
    // X-forwarded-for value
    ip: ipAddress
  });
}
