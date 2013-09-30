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

var StatsdTransport = function(options) {
  options = options || {};

  this.name = 'statsdTransport';

  this.statsd = options.statsd || getStatsdIfEnabled();
};

util.inherits(StatsdTransport, winston.Transport);

StatsdTransport.prototype.log = function(level, msg, meta, callback) {
  if ( ! this.statsd) return callback(null, true);

  if (isIncrementMessage(msg)) {
    this.statsd.increment(getIncrementCounterName(msg), meta);
  }
  else if (isTimingMessage(msg)) {
    this.statsd.timing(getTimingCounterName(msg), meta, meta);
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


var IncrementMessageMatches = {
  "assertion_failure": true,
  "uncaught_exception": true
};

var IncrementRegExpMatches = [
  /^wsapi_code_mismatch\./,
  /^wsapi\./
];

function isIncrementMessage(msg) {
  if (msg in IncrementMessageMatches) return true;

  for (var i = 0, regExp; regExp = IncrementRegExpMatches[i]; ++i) {
    if (regExp.test(msg)) return true;
  }

  return false;
}

function getIncrementCounterName(msg) {
  return PREFIX + msg;
}

var TimingMessageMatches = {
  "bcrypt.compare_time": true,
  "query_time": true,
  "certification_time": true,
  "assertion_verification_time": true
};

var TimingRegExpMatches = [
];

function isTimingMessage(msg) {
  if (msg in TimingMessageMatches) return true;

  for (var i = 0, regExp; regExp = TimingRegExpMatches[i]; ++i) {
    if (regExp.test(msg)) return true;
  }

  return false;
}

function getTimingCounterName(msg) {
  return PREFIX + msg;
}


module.exports = StatsdTransport;
