/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Lloyd Hilaiel <lloyd@hilaiel.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
    filename: filename,
    colorize: true
  })]
});

exports.logger.emitErrs = false;

exports.enableConsoleLogging = function() {
  exports.logger.add(winston.transports.Console, { colorize: true });
};