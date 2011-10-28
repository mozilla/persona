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
 *   Ben Adida <ben@adida.net>
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
 * The metrics module is designed to report interesting events to a file.
 * Metrics files from different production servers can then be aggregated
 * and post processed to get an idea of the degree and ways that browserid is
 * being used by the world, to facilitate capacity planning and changes
 * to the software.
 *
 * NOTE: This is *not* a generic logging mechanism for low level events
 * interesting only to debug or assess the health of a server.
 *
 * DOUBLE NOTE: Sensitive information shouldn't be
 * reported through this mechanism, and it isn't necesary to do so given
 * we're after general trends, not specifics.
 */

const
winston = require("winston"),
configuration = require("./configuration"),
path = require('path'),
fs = require('fs');

// go through the configuration and determine log location
// for now we only log to one place
// FIXME: separate logs depending on purpose?

var log_path = path.join(configuration.get('var_path'), 'log');
var LOGGER;

// simple inline function for creation of dirs
function mkdir_p(p) {
  if (!path.existsSync(p)) {
    mkdir_p(path.dirname(p));
    fs.mkdirSync(p, "0755");
  }
}

function setupLogger() {
  // don't create the logger if it already exists
  if (LOGGER) return;

  if (!log_path)
    return console.log("no log path! Not logging!");
  else
    mkdir_p(log_path);

  var filename = path.join(log_path, configuration.get('process_type') + "-metrics.json");

  LOGGER = new (winston.Logger)({
      transports: [new (winston.transports.File)({filename: filename})]
    });
}

// entry is an object that will get JSON'ified
exports.report = function(type, entry) {
  // setup the logger if need be
  setupLogger();

  // allow convenient reporting of atoms by converting
  // atoms into objects
  if (entry === null || typeof entry !== 'object') entry = { msg: entry };
  if (entry.type) throw "reported metrics may not have a `type` property, that's reserved";
  entry.type = type;

  // timestamp
  if (entry.at) throw "reported metrics may not have an `at` property, that's reserved";
  entry.at = new Date().toUTCString();

  // if no logger, go to console (FIXME: do we really want to log to console?)
  LOGGER.info(JSON.stringify(entry));
};

// utility function to log a bunch of stuff at user entry point
exports.userEntry = function(req) {
  var ipAddress = req.connection.remoteAddress;
  if (req.headers['x-real-ip']) ipAddress = req.headers['x-real-ip'];

  exports.report('signin', {
    browser: req.headers['user-agent'],
    rp: req.headers['referer'],
    // IP address (this probably needs to be replaced with the X-forwarded-for value
    ip: ipAddress
  });
};
