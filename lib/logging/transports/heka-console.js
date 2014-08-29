/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * The metrics module is designed to report interesting events to Heka.
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
const util = require('util');
const filter = require('./filters/metrics-heka');

var HekaConsoleTransport = function (options) {
  options = options || {};
  this._console = options.console || console;
  this.name = 'hekaConsoleTransport';
};
util.inherits(HekaConsoleTransport, winston.Transport);

function noOp() {
}

HekaConsoleTransport.prototype.log = function(level, msg, meta, callback) {
  callback = callback || noOp;

  if ( ! filter.test(msg)) return callback(null, true);

  var entry = filter.toEntry(msg, meta);

  // Heka listens on stdout for entries of the correct format.
  this._console.log(JSON.stringify(entry, null, 2));

  callback(null);
};

var instance;
HekaConsoleTransport.getInstance = function() {
  if (instance) return instance;

  instance = new HekaConsoleTransport();
  return instance;
};

module.exports = HekaConsoleTransport;


