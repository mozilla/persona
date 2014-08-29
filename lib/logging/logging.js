/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * A very thin wrapper around winston for general server logging.
 * Exports a winston Logger instance in exports.logger with several functions
 * corresponding to different log levels.  use it like this:
 *
 *     const logger = require('../libs/logging.js').logger;
 *     logger.debug("you can probably ignore this.  just for debugging.");
 *     logger.info("something happened, here's info about it!");
 *     logger.warn("this isn't good.  it's not a fatal error, but needs attention");
 *     logger.error("this isn't good at all.  I will probably crash soon.");
 *
 * All log messages from all types of logging are put over the Winston pipe.
 * Transports listen on the Winston pipe for messages that are of interest to
 * them, and take appropriate action. This occurs for file logging,
 * metrics logging, KPI logging, and statsd.
 *
 * CEF is slightly different, all CEF messages are sent over the pipe but
 * the cef interface takes care of writing to cef directly.
 */

const
winston = require("winston");

// Must be defined before including the transports. Some of the transports
// depend on the logger being available.
exports.logger = new winston.Logger({});

const LogFileTransport = require('./transports/log-file');
const StatsdTransport = require('./transports/statsd');
const HekaConsoleTransport = require('./transports/heka-console');

exports.logger.add(LogFileTransport, {});
exports.logger.add(StatsdTransport, {});
exports.logger.add(HekaConsoleTransport, {});

exports.enableConsoleLogging = function() {
  exports.logger.add(winston.transports.Console, {
    colorize: true,
    handleExceptions: true
  });
};

if (process.env.LOG_TO_CONSOLE) exports.enableConsoleLogging();

exports.logger.exitOnError = false;
