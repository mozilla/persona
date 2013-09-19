/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
util = require('util'),
winston = require('winston'),
logger = require('../logging').logger,
config = require('../../configuration'),
PREFIX = "browserid." + config.get('process_type') + ".";

var StatsD = false;
try {
  StatsD = require("node-statsd").StatsD;
} catch (requireError) {
  // its ok, its an optionalDependency
}

"use strict";

var StatsdLogger = function() {
  this.name = 'statsdLogger';

  var statsdConfig = config.get('statsd');
  if (statsdConfig && statsdConfig.enabled) {
    if (StatsD) {
      var statsdOptions = {};
      statsdOptions.host = statsdConfig.host || "localhost";
      statsdOptions.port = statsdConfig.port || 8125;

      this.statsd = new StatsD(statsdOptions.host, statsdOptions.port);
    } else {
      logger.error('statsd config enabled, but node-statsd not installed.');

    }
  }

  if (!this.statsd) {
    // introduce a null object that does nothing if statsd
    // could not be created.
    this.statsd = {
      increment: function() {},
      timing: function() {}
    };
  }
};

util.inherits(StatsdLogger, winston.Transport);

StatsdLogger.prototype.log = function(level, msg, meta, callback) {
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

module.exports = StatsdLogger;
