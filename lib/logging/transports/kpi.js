/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
util = require('util'),
winston = require('winston'),
kpi_data = require('../../kpi_data'),
MAX_QUEUE_SIZE = 1;

var KpiLogger = function(options) {
  options = options || {};
  this.queue = [];
  this.name = 'kpiLogger';
};

util.inherits(KpiLogger, winston.Transport);

KpiLogger.prototype.log = function(level, msg, meta, callback) {
  if ( ! /metrics\.report\./.test(msg)) return callback(null, true);

  this.queue.push(meta);
  if (this.queue.length >= MAX_QUEUE_SIZE) {
    var kpis = this.queue;
    kpi_data.store(kpis, function() {});
    this.queue = [];
  }

  callback(null, true);
};



module.exports = KpiLogger;
