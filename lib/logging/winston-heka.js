/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
util = require('util'),
winston = require('winston');

"use strict";

var HekaLogger = function(options) {
  options = options || {};

  this.name = 'hekaLogger';

  this.level = options.level || 'info';
};

util.inherits(HekaLogger, winston.Transport);

HekaLogger.prototype.log = function(level, msg, meta, callback) {
  callback(null, true);
};

module.exports = HekaLogger;

