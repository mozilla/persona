/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const util = require('util');
const winston = require('winston');
const logger = require('../logging').logger;
const config = require('../../configuration');
const timing_filter = require('./filters/statsd-timing');
const increment_filter = require('./filters/statsd-increment');

var StatsD = false;
try {
  StatsD = require("node-statsd").StatsD;
} catch (requireError) {
  // its ok, its an optionalDependency
}

"use strict";

var StatsdTransport = function(options) {
  options = options || {};

  this.name = 'statsdTransport';

  this.statsd = options.statsd || getStatsdIfEnabled();
};

util.inherits(StatsdTransport, winston.Transport);

StatsdTransport.prototype.log = function(level, msg, meta, callback) {
  if ( ! this.statsd) return callback(null, true);

  if (increment_filter.test(msg)) {
    this.statsd.increment(increment_filter.toType(msg), meta);
  }
  else if (timing_filter.test(msg)) {
    this.statsd.timing(timing_filter.toType(msg), meta, meta);
  }

  callback(null, true);
};


function getStatsdIfEnabled() {
  var statsdConfig = config.get('statsd');
  if (statsdConfig && statsdConfig.enabled) {
    if ( ! StatsD) {
      return logger.error(
                  'statsd config enabled, but node-statsd not installed.');
    }

    var statsdOptions = {};
    statsdOptions.host = statsdConfig.host || "localhost";
    statsdOptions.port = statsdConfig.port || 8125;

    return new StatsD(statsdOptions.host, statsdOptions.port);
  }
}


module.exports = StatsdTransport;
