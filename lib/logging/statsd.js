/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
baseExceptions = require('../baseExceptions'),
config = require('../configuration'),
logger = require('./logging').logger,
statsd_request_logger = require("connect-logger-statsd"),
PREFIX = "browserid." + config.get('process_type') + ".";

// send the messages over the winston pipe where they will
// be collected by winston-statsd
module.exports = {
  timing: function(s, v) {
    v = typeof v === "undefined" ? "" : v;
    logger.info('statsd.timing.' + s, v);
  },

  increment: function(s, v) {
    v = typeof v === "undefined" ? "" : v;
    logger.info('statsd.increment.' + s, v);
  },

  setupMiddleware: function(app, prefix) {
    var statsdConfig = config.get('statsd');
    if (statsdConfig && statsdConfig.enabled) {
      app.use(statsd_request_logger({
        host: statsdConfig.hostname || "localhost",
        port: statsdConfig.port || 8125,
        prefix: statsdConfig.prefix || prefix || PREFIX
      }));
    }
  }
};

// Upgrade from console.error to statsd and winston
baseExceptions.removeExceptionHandler();

process.on('uncaughtException', function(err) {
  module.exports.increment('uncaught_exception');
  if (logger) logger.error(err.stack || err);
});


