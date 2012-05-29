/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
StatsD = require("node-statsd").StatsD,
config = require('./configuration');

const PREFIX = "browserid." + config.get('process_type') + ".";

var statsd = undefined;

// start by exporting a stubbed no-op stats reporter
module.exports = {
  timing: function(s, v) {
    if (statsd) statsd.timing(PREFIX + s, v);
  },
  increment: function(s, v) {
    if (statsd) statsd.increment(PREFIX + s, v);
  }
};

var statsd_config = config.get('statsd');

if (statsd_config && statsd_config.enabled) {
  var options = {};
  options["host"] = options["host"] || "localhost";
  options["port"] = options["port"] || 8125;

  statsd = new StatsD(options["host"], options["port"]);
}

process.on('uncaughtException', function(err) {
  if (statsd) statsd.increment(PREFIX + 'uncaught_exception');
});
