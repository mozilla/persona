/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
util = require('util'),
winston = require('winston'),
heka = require('heka'),
config = require('../../configuration'),

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
  info: 6,
  debug: 7,
  help: 5,
  warn: 4,
  error: 2
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

  this.hekaClient.heka(toMessageName(msg), {
    severity: toSeverity(level),
    fields: toData(meta)
  });

  callback(null, true);
};

function toMessageName(msg) {
  return msg.replace(/\.$/, '');
}

function toData(meta) {
  if (typeof meta === "string") return JSON.parse(meta);
  return meta;
}

module.exports = HekaLogger;
