/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Winston transport that takes care of logging cef events to cef.
 *
 * See the cef module's README.md file for more information.
 */
const
winston = require('winston'),
util = require('util'),
cef = require('cef');

var CefLogger = function(options) {
  options = options || {};

  this.cef = cef.getInstance(options);

  this.name = 'cefLogger';
  this.level = 'info';
};
util.inherits(CefLogger, winston.Transport);

module.exports = CefLogger;

var WinstonToCefLevels = {
  info: 'info',
  help: 'alert',
  warn: 'warn',
  error: 'emergency'
};

function toSeverity(level) {
  if (!WinstonToCefLevels[level]) throw new Error("invalid level: " + level);

  return WinstonToCefLevels[level];
}

CefLogger.prototype.log = function(level, msg, meta, callback) {
  if ( ! /^cef\./.test(msg)) return callback(null, true);

  console.log("CEF!!!!", meta);
  this.cef[toSeverity(level)](meta);

  callback(null, true);
};
