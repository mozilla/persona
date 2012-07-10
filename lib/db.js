/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
      if (cb) cb(null);
    }
  });
};


exports.close = function(cb) {
  checkReady();
  driver.close(function(err) {
    ready = false;
    if (cb) cb(err);
  });
};

exports.closeAndRemove = function(cb) {
  checkReady();
  driver.closeAndRemove(function(err) {
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
  'authForVerificationSecret',
  'checkAuth',
  'emailForVerificationSecret',
  'emailKnown',
  'emailToUID',
  'emailType',
  'emailIsVerified',
  'emailsBelongToSameAccount',
  'haveVerificationSecret',
  'isStaged',
  'lastStaged',
  'listEmails',
  'ping',
  'userKnown',
  'userOwnsEmail',
  'verificationSecretForEmail'
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
  'completeCreateUser',
  'completeConfirmEmail',
  'completePasswordReset',
  'removeEmail',
  'cancelAccount',
  'updatePassword',
  'createUserWithPrimaryEmail',
  'addPrimaryEmailToAccount'
].forEach(function(fn) {
  exports[fn] = function() {
    if (!config.get('database').may_write) {
      throw "this process may not write the database"
    }
    checkReady();
    driver[fn].apply(undefined, arguments);
  };
});

exports.addTestUser = function() {
  // would we like to check the environment here?
  checkReady();
  driver['addTestUser'].apply(undefined, arguments);
};
