/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// a little tiny task focused wrapper around the excellent api exposed by
// jwcrypto

const
userDB = require('./user_db.js'),
jwk = require('jwcrypto/jwk.js'),
jwt = require('jwcrypto/jwt.js'),
vep = require('jwcrypto/vep.js');

const NUM_KEYPAIRS = 5;

process.stdout.write("generating " + NUM_KEYPAIRS +
                     " keypairs to be (re)used during load generation: ");

var keyPairs = [];

while (keyPairs.length < NUM_KEYPAIRS)
{
  keyPairs.push(jwk.KeyPair.generate("DS", 256));
  process.stdout.write(".");
}

process.stdout.write("\n");


exports.getKeyPair = function() {
  return userDB.any(keyPairs);
};

var assertions = [];

exports.getAssertion = function(obj) {
  // we can memoize here, returning existing assertions to reduce
  // compute cost of loadgen client, to simulate more load on servers

  // this is a synthetic benchmark and for assertions we don't really care
  // what email or RP is associated with the assertion, just that
  // it applies load.

  function genAssertion() {
    var expirationDate = new Date(obj.now.getTime() + (2 * 60 * 1000));
    var tok = new jwt.JWT(null, expirationDate, obj.audience);
    var assertion = vep.bundleCertsAndAssertion([obj.cert], tok.sign(obj.secretKey));

    return {
      audience: obj.audience,
      assertion: assertion,
      expirationDate: expirationDate
    };
  }

  if (assertions.length >= 30) {
    var which = Math.floor(Math.random()*30)
    var assertion = assertions[which];
    // consider assertions which expire in the next minute stale
    if ((assertion.expirationDate - new Date()) < (60 * 1000)) {
      assertion = assertions[which] = genAssertion();
    }
    return assertions[which];
  }

  var a = genAssertion();
  assertions.push(a);
  return a;
};
