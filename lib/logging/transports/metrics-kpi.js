/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const util = require('util');
const winston = require('winston');
const kpi_data = require('../../kpi_data');
const logger = require('../logging').logger;
const config = require('../../configuration');
const filter = require('./filters/metrics');

const FIELDS_TO_SEND_TO_PIGGYBANK = [
  "type",
  "timestamp",
  "user_agent"
];

var MetricsKpiggybankTransport = function(options) {
  options = options || {};
  this.queue = [];
  this.name = 'metricsKpiggybankTransport';
};
MetricsKpiggybankTransport.BATCH_SIZE = config.get('kpi_metrics_batch_size');

util.inherits(MetricsKpiggybankTransport, winston.Transport);

MetricsKpiggybankTransport.prototype.log
    = function(level, msg, meta, callback) {
  if ( ! filter.test(msg)) return callback(null, true);
  if ( ! config.get('kpi_send_metrics')) return callback(null, true);


  var entry = toEntry(msg, meta);
  this.queue.push(entry);

  if (isQueueFull.call(this)) {
    clearQueue.call(this);
  }

  callback(null, true);
};

function isQueueFull() {
  return this.queue.length >= MetricsKpiggybankTransport.BATCH_SIZE;
}

function clearQueue() {
  var kpis = this.queue;
  this.queue = [];
  kpi_data.store(kpis, function(err, success) {
    if (err) return logger.warn(String(err));
    if (!success) logger.warn("failed to store interaction data");
  });
}

function toEntry(msg, entry) {
  return whitelistedFields(filter.toEntry(msg, entry),
                  FIELDS_TO_SEND_TO_PIGGYBANK);
}

function whitelistedFields(entry, whitelist) {
  var allowed = {};

  for (var key in entry) {
    if (whitelist.indexOf(key) > -1) allowed[key] = entry[key];
  }

  return allowed;
}


module.exports = MetricsKpiggybankTransport;
