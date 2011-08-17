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

const
winston = require("winston"),
configuration = require("./configuration"),
path = require('path'),
fs = require('fs');

// go through the configuration and determine log location
// for now we only log to one place
// FIXME: separate logs depending on purpose?

var log_path = configuration.get('log_path');
var LOGGERS = [];

// simple inline function for creation of dirs
function mkdir_p(p) {
  if (!path.existsSync(p)) {
    mkdir_p(path.dirname(p));
    fs.mkdirSync(p, "0755");
  }
}

function setupLogger(category) {
  if (!log_path)
    return console.log("no log path! Not logging!");
  else
    mkdir_p(log_path);


  // don't create the logger if it already exists
  if (LOGGERS[category])
    return;

  var filename = path.join(log_path, category + "-log.txt");

  LOGGERS[category] = new (winston.Logger)({
      transports: [new (winston.transports.File)({filename: filename})]
    });
}

// entry is an object that will get JSON'ified
exports.report = function(category, entry) {
  // entry must have at least a type
  if (!entry.type)
    throw new Error("every log entry needs a type");

  // setup the logger if need be
  setupLogger(category);

  // timestamp
  entry.at = new Date().toUTCString();

  // if no logger, go to console (FIXME: do we really want to log to console?)
  LOGGERS[category].info(JSON.stringify(entry));
};

// utility function to log a bunch of stuff at user entry point
exports.userEntry = function(category, req) {
  exports.report(category, {
      type: 'signin',
      browser: req.headers['user-agent'],
      rp: req.headers['referer'],
      // IP address (this probably needs to be replaced with the X-forwarded-for value
      ip: req.connection.remoteAddress
    });
};