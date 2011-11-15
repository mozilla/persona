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
 *     Ben Adida <benadida@mozilla.com>
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

// certificate authority

var jwcert = require('jwcrypto/jwcert'),
    jwk = require('jwcrypto/jwk'),
    jws = require('jwcrypto/jws'),
    path = require("path"),
    fs = require("fs"),
    config = require('../configuration.js'),
    secrets = require('../secrets.js'),
    logger = require('../logging.js').logger;

var HOSTNAME = config.get('hostname');

const secret_key = secrets.loadSecretKey('root', config.get('var_path'));

if (!secret_key) {
  logger.error("no secret key read from " + config.get('var_path') +
               " can't continue");
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
  return new jwcert.JWCert(HOSTNAME, expiration, publicKey, {email: email}).sign(secret_key);
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
exports.PUBLIC_KEY = config.get('public_key');
