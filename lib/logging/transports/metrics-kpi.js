/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
util = require('util'),
winston = require('winston'),
kpi_data = require('../../kpi_data'),
logger = require('../logging').logger,
config = require('../../configuration');

var MetricsKpiggybankTransport = function(options) {
  options = options || {};
  this.queue = [];
  this.name = 'metricsKpiggybankTransport';
};
MetricsKpiggybankTransport.BATCH_SIZE = config.get('kpi_metrics_batch_size');

util.inherits(MetricsKpiggybankTransport, winston.Transport);

MetricsKpiggybankTransport.prototype.log
    = function(level, msg, meta, callback) {
  if ( ! /metrics\.report\./.test(msg)) return callback(null, true);
  if ( ! config.get('kpi_send_metrics')) return callback(null, true);

  this.queue.push(meta);
  if (this.queue.length >= MetricsKpiggybankTransport.BATCH_SIZE) {
    var kpis = this.queue;
    this.queue = [];
    kpi_data.store(kpis, function(err, success) {
      if (err) return logger.warn(String(err));
      if (!success) logger.log("failed to store interaction data");
    });
  }

  callback(null, true);
};



module.exports = MetricsKpiggybankTransport;
