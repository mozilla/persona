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

const winston = require('winston');
const File = winston.transports.File;
const util = require('util');
const configuration = require('../../configuration');
const path = require('path');
const mkdirp = require('mkdirp');
const _ = require('underscore');

// go through the configuration and determine log location
// for now we only log to one place
// FIXME: separate logs depending on purpose?

var log_path = path.join(configuration.get('var_path'), 'log');
if (!log_path)
  return console.log('no log path! Not logging!');
else
  mkdirp.sync(log_path, '0755');

var filename = path.join(log_path,
                    configuration.get('process_type') + '-metrics.json');
if (process.env.METRICS_LOG_FILE) {
  filename = process.env.METRICS_LOG_FILE;
}

var MetricsFileTransport = function(options) {
  options = _.extend({
    timestamp: function () { return new Date().toISOString(); },
    filename: filename,
    colorize: false,
    handleExceptions: false
  }, options);

  File.call(this, options);
};
util.inherits(MetricsFileTransport, File);

MetricsFileTransport.prototype.name = 'metricsFileTransport';

MetricsFileTransport.prototype.log = function(level, msg, meta, callback) {
  if (!/^metrics\.report\./.test(msg)) return callback(null, true);

  msg = msg.replace(/^metrics\.report\./, '');
  return File.prototype.log.call(this,
              level, JSON.stringify(meta), null, callback);
};


module.exports = MetricsFileTransport;


