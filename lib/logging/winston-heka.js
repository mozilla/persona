/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
util = require('util'),
winston = require('winston'),
heka = require('heka'),
logger = require('./logging').logger,
config = require('../configuration'),

PREFIX = "browserid." + config.get('process_type');

var hekaConf = {
    'sender': {'factory': 'heka/senders:udpSenderFactory',
               'hosts': 'localhost',
               'ports': 5565,
                'encoder': 'heka/senders/encoders:jsonEncoder'
                //'encoder': 'heka/senders/encoders:protobufEncoder'
    },
    'logger': PREFIX,
    'severity': 5
};

var WinstonToHekaLevels = {
  info: 'info',
  debug: 'debug',
  help: 'notice',
  warn: 'warn',
  error: 'critical'
};

function toSeverity(level) {
  if (!WinstonToHekaLevels[level]) throw new Error("invalid level: " + level);

  return WinstonToHekaLevels[level];
}

"use strict";

var HekaLogger = function(options) {
  this.name = 'hekaLogger';

  this.level = options.level || 'info';

  this.hekaClient = heka.clientFromJsonConfig(JSON.stringify(hekaConf));
};

util.inherits(HekaLogger, winston.Transport);

HekaLogger.prototype.log = function(level, msg, meta, callback) {
  if ( ! /metrics\.report\./.test(msg)) return callback(null, true);

  var payload = {
    msg: msg.replace(/\.$/, '')
  };
  if (meta) payload.data = toData(meta);

  this.hekaClient[toSeverity(level)](JSON.stringify(payload));

  callback(null, true);
};

function toData(meta) {
  if (typeof meta === "string") return JSON.parse(meta);
  return meta;
}

module.exports = HekaLogger;
