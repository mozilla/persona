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
configuration = require("../configuration"),
path = require('path'),
fs = require('fs');

// existsSync moved from path in 0.6.x to fs in 0.8.x
var existsSync = typeof fs.existsSync === 'function' ? fs.existsSync : path.existsSync;

// go through the configuration and determine log location
// for now we only log to one place
// FIXME: separate logs depending on purpose?

var log_path = path.join(configuration.get('var_path'), 'log');

// simple inline function for creation of dirs
function mkdir_p(p) {
  if (!existsSync(p)) {
    mkdir_p(path.dirname(p));
    fs.mkdirSync(p, "0755");
  }
}

if (!log_path)
  return console.log("no log path! Not logging!");
else
  mkdir_p(log_path);

var filename = path.join(log_path, configuration.get('process_type') + "-metrics.json");
if (process.env.METRICS_LOG_FILE) {
  filename = process.env.METRICS_LOG_FILE;
}

var MetricsFileLogger = function() {
  var logger = new winston.transports.File({
    timestamp: function () { return new Date().toISOString(); },
    filename: filename
  });

  var _log = logger.log;
  logger.log = function(level, msg, meta, callback) {
    _log.apply(this, arguments);
    /*if (/^metrics\.report/.test(msg)) return _log.call(this, level, meta, callback);*/

    callback(null, true);
  };
  return logger;
};


module.exports = MetricsFileLogger;


