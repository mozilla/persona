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
winston = require("winston"),
configuration = require("./configuration"),
path = require('path'),
fs = require('fs'),
urlparse = require('urlparse');

// existsSync moved from path in 0.6.x to fs in 0.8.x
if (typeof fs.existsSync === 'function') {
  var existsSync = fs.existsSync;
} else {
  var existsSync = path.existsSync;
}

// go through the configuration and determine log location
// for now we only log to one place
// FIXME: separate logs depending on purpose?

var log_path = path.join(configuration.get('var_path'), 'log');
var LOGGER;

// simple inline function for creation of dirs
function mkdir_p(p) {
  if (!existsSync(p)) {
    mkdir_p(path.dirname(p));
    fs.mkdirSync(p, "0755");
  }
}

function setupLogger() {
  // don't create the logger if it already exists
  if (LOGGER) return;

  if (!log_path)
    return console.log("no log path! Not logging!");
  else
    mkdir_p(log_path);

  var filename = path.join(log_path, configuration.get('process_type') + "-metrics.json");

  LOGGER = new (winston.Logger)({
      transports: [new (winston.transports.File)({filename: filename})],
      timestamp: function () { return new Date().toISOString() },
    });
}

// entry is an object that will get JSON'ified
exports.report = function(type, entry) {
  // setup the logger if need be
  setupLogger();

  // allow convenient reporting of atoms by converting
  // atoms into objects
  if (entry === null || typeof entry !== 'object') entry = { msg: entry };
  if (entry.type) throw "reported metrics may not have a `type` property, that's reserved";
  entry.type = type;

  // timestamp
  if (entry.at) throw "reported metrics may not have an `at` property, that's reserved";
  entry.at = new Date().toUTCString();

  // if no logger, go to console (FIXME: do we really want to log to console?)
  LOGGER.info(JSON.stringify(entry));
};

// utility function to log a bunch of stuff at user entry point
exports.userEntry = function(req) {
  var ipAddress = req.connection.remoteAddress;
  if (req.headers['x-real-ip']) ipAddress = req.headers['x-real-ip'];

  var referer = null;
  try {
    // don't log more than we need
    referer = urlparse(req.headers['referer']).originOnly().toString();
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
