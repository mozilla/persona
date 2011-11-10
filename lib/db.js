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

var logger = require('./logging.js').logger;
const config = require('./configuration.js');

var driver;

var ready = false;
var waiting = [];

function checkReady() {
  if (!ready) throw "database not ready.  did you call open()?";
}

// async break allow database path to be configured by calling code
// a touch tricky cause client must set dbPath before releasing
// control of the runloop
exports.open = function(cfg, cb) {
  var driverName = "json";
  if (cfg && cfg.driver) driverName = cfg.driver;
  try {
    driver = require('./db/' + driverName + '.js');
  } catch(e) {
    var msg = "FATAL: couldn't find database driver: " + driverName;
    console.log(msg);
    throw msg + ": " + e.toString();
  }

  driver.open(cfg, function(error) {
    if (error) {
      if (cb) cb(error);
      else {
        logger.error(error);
        process.exit(1);
      }
    } else {
      ready = true;
      waiting.forEach(function(f) { f() });
      waiting = [];
      if (cb) cb();
    }
  });
};


exports.close = function(cb) {
  driver.close(function(err) {
    ready = false;
    if (cb) cb(err);
  });
};

// accepts a function that will be invoked once the database is ready for transactions.
// this hook is important to pause the rest of application startup until async database
// connection establishment is complete.
exports.onReady = function(f) {
  setTimeout(function() {
    if (ready) f();
    else waiting.push(f);
  }, 0);
};

// these are read only database calls
[
  'emailKnown',
  'isStaged',
  'emailsBelongToSameAccount',
  'emailForVerificationSecret',
  'checkAuth',
  'listEmails',
  'lastStaged'
].forEach(function(fn) {
  exports[fn] = function() {
    checkReady();
    driver[fn].apply(undefined, arguments);
  };
});

// These are database calls that write.  Database
// writing must be enabled on the process for them
// to work.
[
  'stageUser',
  'stageEmail',
  'gotVerificationSecret',
  'removeEmail',
  'cancelAccount',
  'updatePassword',
].forEach(function(fn) {
  exports[fn] = function() {
    if (!config.get('database').may_write) {
      throw "this process may not write the database"
    }
    checkReady();
    driver[fn].apply(undefined, arguments);
  };
});
