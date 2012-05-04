/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// certificate authority

var jwcrypto = require('jwcrypto'),
    cert = jwcrypto.cert,
    path = require("path"),
    fs = require("fs"),
    secrets = require('../secrets.js'),
    logger = require('../logging.js').logger,
    urlparse = require('urlparse');

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

function certify(hostname, email, publicKey, expiration, cb) {
  if (expiration == null)
    return cb("expiration cannot be null");

  cert.sign(publicKey, {email: email},
            {issuer: hostname, issuedAt: new Date(), expiresAt: expiration},
            null,
            secret_key, cb);
}

// hostname is issuer
// certChain is an array of raw certs
// the cb is called with the last public key and principal
function verifyChain(hostname, certChain, cb) {
  return cert.verifyChain(
    certChain, new Date(),
    function(issuer, next) {
      // for now we only do browserid.org issued keys
      if (issuer != hostname)
        return next("only verifying " + hostname + "-issued keys");

      next(null, exports.PUBLIC_KEY);
    }, function(err, certParamsArray) {
      if (err) return cb(err);

      var lastParams = certParamsArray[certParamsArray.length - 1];
      cb(null, lastParams.certParams['public-key'], lastParams.certParams.principal, certParamsArray);
    });
}

function verifyBundle(hostname, bundle, cb) {
  return cert.verifyBundle(
    bundle, new Date(),
    function(issuer, next) {
      // for now we only do browserid.org issued keys
      if (issuer != hostname)
        return next("only verifying " + hostname + "-issued keys");

      next(null, exports.PUBLIC_KEY);
    }, function(err, certParamsArray, payload, assertionParams) {
      if (err) return cb(err);

      cb(null, certParamsArray, payload, assertionParams);
    });  
}

// exports, not the key stuff
exports.certify = certify;
exports.verifyChain = verifyChain;
exports.verifyBundle = verifyBundle;
exports.parsePublicKey = parsePublicKey;
exports.PUBLIC_KEY = public_key;
