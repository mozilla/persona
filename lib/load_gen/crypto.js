/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// a little tiny task focused wrapper around the excellent api exposed by
// jwcrypto

const
userDB = require('./user_db.js'),
jwcrypto = require('jwcrypto');

// load algorithms
require("jwcrypto/lib/algs/rs");
require("jwcrypto/lib/algs/ds");

const NUM_KEYPAIRS = 5;

var keyPairs = [];

exports.init = function(cb) {
  process.stdout.write("generating " + NUM_KEYPAIRS +
                       " keypairs to be (re)used during load generation: ");
  function next() {
    if (keyPairs.length < NUM_KEYPAIRS) {
      jwcrypto.generateKeypair(
        {algorithm: "DS", keysize: 256},
        function(err, kp) {
          if (err) return cb(err);
          keyPairs.push(kp);
          process.stdout.write(".");
          next();
        });
    } else {
      process.stdout.write("\n");
      cb(null);
    }
  }
  next();
};

exports.getKeyPair = function() {
  return userDB.any(keyPairs);
};

var assertions = [];

exports.getAssertion = function(obj, cb) {
  // we can memoize here, returning existing assertions to reduce
  // compute cost of loadgen client, to simulate more load on servers

  // this is a synthetic benchmark and for assertions we don't really care
  // what email or RP is associated with the assertion, just that
  // it applies load.

  function genAssertion(cb) {
    var expirationDate = new Date(obj.now.getTime() + (2 * 60 * 1000));
    jwcrypto.assertion.sign(
      {},
      {
        audience: obj.audience,
        expiresAt: expirationDate
      }, obj.secretKey, function(err, signedAssertion) {
        if (err) cb(err);
        else {
          var assertion = jwcrypto.cert.bundle(obj.cert, signedAssertion);
          cb(null, {
            audience: obj.audience,
            assertion: assertion,
            expirationDate: expirationDate
          });
        }
      });
  }

  if (assertions.length >= 30) {
    var which = Math.floor(Math.random()*30)
    var assertion = assertions[which];
    // consider assertions which expire in the next minute stale
    if ((assertion.expirationDate - new Date()) < (60 * 1000)) {
      assertions.splice(which, 1);
    } else {
      return process.nextTick(function() {
        return cb(null, assertion);
      });
    }
  }

  genAssertion(function(err, a) {
    assertions.push(a);
    cb(err, a);
  });
};
