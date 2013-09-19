/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * The metrics module is designed to report interesting events to a file.
 * Metrics files from different production servers can then be aggregated
 * and post processed to get an idea of the degree and ways that browserid is
 * being used by the world, to facilitate capacity planning and changes
 * to the software.
 *
 * NOTE: This is *not* a generic logging mechanism for low level events
 * interesting only to debug or assess the health of a server.
 *
 * DOUBLE NOTE: Sensitive information shouldn't be
 * reported through this mechanism, and it isn't necesary to do so given
 * we're after general trends, not specifics.
 */

const
logger = require("./logging").logger,
urlparse = require('urlparse');

// entry is an object that will get JSON'ified
exports.report = function(type, entry) {
  // allow convenient reporting of atoms by converting atoms into objects
  if (entry === null || typeof entry !== 'object') entry = { msg: entry };
  if (entry.type) throw "reported metrics may not have a `type` property, that's reserved";
  entry.type = type;

  // timestamp
  if (entry.at) throw "reported metrics may not have an `at` property, that's reserved";
  entry.at = new Date().toUTCString();

  logger.info('metrics.report.', entry);
};

// utility function to log a bunch of stuff at user entry point
exports.userEntry = function(req) {
  var ipAddress = req.connection.remoteAddress;
  if (req.headers['x-real-ip']) ipAddress = req.headers['x-real-ip'];

  var referer = null;
  try {
    // don't log more than we need
    referer = urlparse(req.headers.referer).originOnly().toString();
  } catch(e) {
    // ignore malformed referrers.  just log null
  }

  exports.report('signin', {
    browser: req.headers['user-agent'],
    rp: referer,
    // IP address (this probably needs to be replaced with the X-forwarded-for value
    ip: ipAddress
  });
};
