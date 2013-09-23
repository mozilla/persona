/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
util = require('util'),
winston = require('winston'),
kpi_data = require('../../kpi_data'),
logger = require('../logging').logger,
ITEMS_TO_SEND = 20;

var KpiLogger = function(options) {
  options = options || {};
  this.queue = [];
  this.name = 'kpiLogger';
};

util.inherits(KpiLogger, winston.Transport);

KpiLogger.prototype.log = function(level, msg, meta, callback) {
  if ( ! /metrics\.report\./.test(msg)) return callback(null, true);

  this.queue.push(meta);
  if (this.queue.length >= ITEMS_TO_SEND) {
    var kpis = this.queue;
    this.queue = [];
    kpi_data.store(kpis, function(err, success) {
      if (err) return logger.warn(String(err));
      if (!success) logger.log("failed to store interaction data");
    });
  }

  callback(null, true);
};



module.exports = KpiLogger;
