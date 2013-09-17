/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
util = require('util'),
winston = require('winston'),
amqp = require('amqp'),
logger = require('./logging').logger,
config = require('../configuration'),

PREFIX = "browserid." + config.get('process_type');

var exchangeConfig = {
  type: 'fanout',
  durable: true
};

const EXCHANGE_NAME = "exchange_a";
const QUEUE_NAME = "metrics.report";

var RabbitLogger = function(options) {
  this.name = 'rabbitLogger';

  this.level = options.level || 'info';

  var connection = this.rabbit = amqp.createConnection({
    host: 'localhost'
  });

  var self = this;
  connection.on('ready', function() {
    connection.exchange(EXCHANGE_NAME, exchangeConfig, function(exchange) {
      self.exchange = exchange;
    });
  });
};

util.inherits(RabbitLogger, winston.Transport);

RabbitLogger.prototype.log = function(level, msg, meta, callback) {
  if ( ! /metrics\.report\./.test(msg)) return callback(null, true);

  var payload = {
    level: level,
    data: JSON.parse(meta)
  };

  if (!this.exchange) return;
  this.exchange.publish('metrics.report', payload);

  callback(null, true);
};



module.exports = RabbitLogger;
