const
jwk = require('jwcrypto/jwk.js'),
jwt = require('jwcrypto/jwt.js'),
vep = require('jwcrypto/vep.js'),
jwcert = require('jwcrypto/jwcert.js'),
path = require("path");

// the private secret of our built-in primary
const g_privKey = jwk.SecretKey.fromSimpleObject(
  JSON.parse(require('fs').readFileSync(
    path.join(__dirname, '..', '..', 'example', 'primary', 'sample.privatekey'))));


function User(options) {
  // upon allocation of a user, we'll gen a keypair and get a signed cert
  this._keyPair = jwk.KeyPair.generate("DS", 256);
  var expiration = new Date();
  expiration.setTime(new Date().valueOf() + 60 * 60 * 1000);
  this._cert = new jwcert.JWCert(
    options.domain, expiration, new Date(),
    this._keyPair.publicKey, {email: options.email}).sign(g_privKey);
}

User.prototype.getAssertion = function(origin) {
  var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
  var tok = new jwt.JWT(null, expirationDate, origin);
  return vep.bundleCertsAndAssertion([this._cert], tok.sign(this._keyPair.secretKey));
}

module.exports = User;