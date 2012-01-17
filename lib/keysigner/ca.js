/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// certificate authority

var jwcert = require('jwcrypto/jwcert'),
    jwk = require('jwcrypto/jwk'),
    jws = require('jwcrypto/jws'),
    path = require("path"),
    fs = require("fs"),
    config = require('../configuration.js'),
    secrets = require('../secrets.js'),
    logger = require('../logging.js').logger;

const HOSTNAME = config.get('hostname');
logger.info("Certs will be issued from: " + HOSTNAME);


try {
  const secret_key = secrets.loadSecretKey();
  const public_key = secrets.loadPublicKey();
} catch(e){
  logger.error("can't read keys, exiting: " + e);
  setTimeout(function() { process.exit(1); }, 0);
}

function parsePublicKey(serializedPK) {
  return jwk.PublicKey.deserialize(serializedPK);
}

function parseCert(serializedCert) {
  var cert = new jwcert.JWCert();
  cert.parse(serializedCert);
  return cert;
}

function certify(email, publicKey, expiration) {
  if (expiration == null)
    throw "expiration cannot be null";
  return new jwcert.JWCert(HOSTNAME, expiration, new Date(), publicKey, {email: email}).sign(secret_key);
}

function verifyChain(certChain, cb) {
  // raw certs
  return jwcert.JWCert.verifyChain(
    certChain, new Date(),
    function(issuer, next) {
      // for now we only do browserid.org issued keys
      if (issuer != HOSTNAME)
        return next(null);

      next(exports.PUBLIC_KEY);
    }, cb);
}

// exports, not the key stuff
exports.certify = certify;
exports.verifyChain = verifyChain;
exports.parsePublicKey = parsePublicKey;
exports.parseCert = parseCert;
exports.PUBLIC_KEY = public_key;
