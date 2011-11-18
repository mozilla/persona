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

exports.getAssertion = function(obj) {
  // XXX: we can memoize here at some point, returning existing assertions
  // to reduce compute cost of loadgen client, to simulate more load
  // on servers
  var expirationDate = new Date(obj.now.getTime() + (2 * 60 * 1000));
  var tok = new jwt.JWT(null, expirationDate, obj.audience);
  var assertion = vep.bundleCertsAndAssertion([obj.cert], tok.sign(obj.secretKey));
  return assertion;
};
