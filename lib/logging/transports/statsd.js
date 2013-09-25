/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const util = require('util');
const winston = require('winston');
const logger = require('../logging').logger;
const config = require('../../configuration');

var StatsD = false;
try {
  StatsD = require("node-statsd").StatsD;
} catch (requireError) {
  // its ok, its an optionalDependency
}

const PREFIX = "browserid." + config.get('process_type') + ".";

"use strict";

var StatsdTransport = function() {
  this.name = 'statsdTransport';

  var statsdConfig = config.get('statsd');
  if (statsdConfig && statsdConfig.enabled) {
    if ( ! StatsD) {
      return logger.error(
                  'statsd config enabled, but node-statsd not installed.');
    }

    var statsdOptions = {};
    statsdOptions.host = statsdConfig.host || "localhost";
    statsdOptions.port = statsdConfig.port || 8125;

    this.statsd = new StatsD(statsdOptions.host, statsdOptions.port);
  }
};

util.inherits(StatsdTransport, winston.Transport);

StatsdTransport.prototype.log = function(level, msg, meta, callback) {
  if ( ! this.statsd) return callback(null, true);

  if (/^statsd.increment\./.test(msg)) {
    msg = msg.replace(/^statsd.increment\./, PREFIX);
    this.statsd.increment(msg, meta);
  }
  else if (/^statsd.timing\./.test(msg)) {
    msg = msg.replace(/^statsd.timing\./, PREFIX);
    this.statsd.timing(msg, meta, meta);
  }

  callback(null, true);
};

module.exports = StatsdTransport;
