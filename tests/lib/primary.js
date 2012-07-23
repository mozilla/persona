/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
jwcrypto = require('jwcrypto'),
path = require("path");

require("jwcrypto/lib/algs/rs");
require("jwcrypto/lib/algs/ds");

// the private secret of our built-in primary
const g_privKey = jwcrypto.loadSecretKey(
  require('fs').readFileSync(
    path.join(__dirname, '..', '..', 'example', 'primary', 'sample.privatekey')));

function User(options) {
  this.options = options;
}

User.prototype.setup = function(cb) {
  var self = this;

  // upon allocation of a user, we'll gen a keypair and get a signed cert
  jwcrypto.generateKeypair({algorithm:"DS", keysize:256}, function(err, kp) {
    if (err) return cb(err);

    self._keyPair = kp;

    var expiration = new Date();
    expiration.setTime(new Date().valueOf() + 60 * 60 * 1000);

    jwcrypto.cert.sign(self._keyPair.publicKey, {email: self.options.email},
                       {expiresAt: expiration, issuer: self.options.domain, issuedAt: new Date()},
                       {}, self.options.privKey || g_privKey, function(err, signedCert) {
                         if (err) return cb(err);
                         self._cert = signedCert;

                         cb(null);
                       });
  });
}

User.prototype.getAssertion = function(origin, cb) {
  var self = this;
  var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
  jwcrypto.assertion.sign({}, {audience: origin, issuer: "127.0.0.1", expiresAt: expirationDate},
                         this._keyPair.secretKey, function(err, signedObject) {
                           if (err) return cb(err);

                           cb(null, jwcrypto.cert.bundle([self._cert], signedObject));
                         });
};

module.exports = User;
