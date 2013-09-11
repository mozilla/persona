/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Winston transport that takes care of writing to the process specific log.
 * Logs are generally found in <project_root>/var/log/<process_name>.log
 */

const
util = require('util'),
winston = require('winston'),
configuration = require("../configuration"),
path = require('path'),
fs = require('fs');

"use strict";

var existsSync = fs.existsSync ? fs.existsSync : path.existsSync;

// go through the configuration and determine log location
var log_path = path.join(configuration.get('var_path'), 'log');

// simple inline function for creation of dirs
function mkdir_p(p) {
  if (!existsSync(p)) {
    mkdir_p(path.dirname(p));
    fs.mkdirSync(p, "0755");
  }
}

mkdir_p(log_path);

var filename = path.join(log_path, configuration.get('process_type') + ".log");

var FileLogger = function() {
  return new winston.transports.File({
    timestamp: function () { return new Date().toISOString(); },
    filename: filename,
    colorize: true,
    handleExceptions: true
  });
};


module.exports = FileLogger;

