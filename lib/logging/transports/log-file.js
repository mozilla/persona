/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Winston transport that takes care of writing to the process specific log.
 * Logs are generally found in <project_root>/var/log/<process_name>.log
 */

const winston = require('winston');
const File = winston.transports.File;
const util = require('util');
const configuration = require("../../configuration");
const path = require('path');
const mkdirp = require('mkdirp');
const _ = require('underscore');

"use strict";

// go through the configuration and determine log location
var log_path = path.join(configuration.get('var_path'), 'log');
if (!log_path)
  return console.log("no log path! Not logging!");
else
  mkdirp.sync(log_path, "0755");

var filename = path.join(log_path, configuration.get('process_type') + ".log");

var FileTransport = function(options) {
  options = _.extend({
    timestamp: function () { return new Date().toISOString(); },
    filename: filename,
    colorize: true,
    handleExceptions: true
  }, options);

  File.call(this, options);
};
util.inherits(FileTransport, File);

FileTransport.prototype.name = 'fileTransport';


module.exports = FileTransport;

