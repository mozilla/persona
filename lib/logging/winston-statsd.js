/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
util = require('util'),
winston = require('winston'),
statsd = require('./statsd');

"use strict";

var StatsdLogger = function(options) {
  this.name = 'statsdLogger';

  this.level = options.level || 'info';
};

util.inherits(StatsdLogger, winston.Transport);

StatsdLogger.prototype.log = function(level, msg, meta, callback) {
  if (/^increment\./.test(msg)) {
    msg = msg.replace(/^increment\./, '');
    console.log('STATSD increment!!!!!', msg, meta);
    statsd.increment(msg);
  }
  else if (/^timing\./.test(msg)) {
    msg = msg.replace(/^timing\./, '');
    console.log('STATSD timing!!!!!', msg, meta);
    statsd.timing(msg, meta);
  }

  callback(null, true);
};

module.exports = StatsdLogger;

