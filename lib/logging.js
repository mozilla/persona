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
 */

const
winston = require("winston"),
configuration = require("./configuration"),
path = require('path'),
fs = require('fs');

// go through the configuration and determine log location
var log_path = path.join(configuration.get('var_path'), 'log');

// simple inline function for creation of dirs
function mkdir_p(p) {
  if (!path.existsSync(p)) {
    mkdir_p(path.dirname(p));
    fs.mkdirSync(p, "0755");
  }
}

mkdir_p(log_path);

var filename = path.join(log_path, configuration.get('process_type') + ".log");

exports.logger = new (winston.Logger)({
  transports: [new (winston.transports.File)({
    timestamp: function () { return new Date().toISOString() },
    filename: filename,
    colorize: true,
    handleExceptions: true
  })]
});

exports.enableConsoleLogging = function() {
  exports.logger.add(winston.transports.Console, {
    colorize: true,
    handleExceptions: true
  });
};

if (process.env['LOG_TO_CONSOLE']) exports.enableConsoleLogging();

exports.logger.exitOnError = false;
