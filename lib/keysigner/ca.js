/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// certificate authority

var jwcrypto = require('jwcrypto'),
    cert = jwcrypto.cert,
    secrets = require('../secrets.js'),
    logger = require('../logging/logging.js').logger;

// load up the right algorithms
require("jwcrypto/lib/algs/rs");
require("jwcrypto/lib/algs/ds");

try {
  const secret_key = secrets.loadSecretKey();
  const public_key = secrets.loadPublicKey();
} catch(e){
  logger.error("can't read keys, exiting: " + e);
  setTimeout(function() { process.exit(1); }, 0);
}

function parsePublicKey(serializedPK) {
  return jwcrypto.loadPublicKey(serializedPK);
}

function certify(hostname, email, publicKey, expiration, unverified, cb) {
  if (expiration == null)
    return cb("expiration cannot be null");

  //TODO: use a different secret if unverified

  var principal = {};
  principal[ unverified ? 'unverified-email' : 'email' ] = email;


  cert.sign({publicKey: publicKey, principal: principal},
            {issuer: hostname, issuedAt: new Date(), expiresAt: expiration},
            null,
            secret_key, cb);
}

// exports, not the key stuff
exports.certify = certify;
exports.parsePublicKey = parsePublicKey;
exports.PUBLIC_KEY = public_key;
