/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
fs = require('fs'),
jwcrypto = require('jwcrypto'),
crypto = require('crypto');

// make this async capable
function bytesToChars(buf) {
  var str = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  // yes, we are biasing the output here a bit.
  // I'm ok with that. We can improve this over time.
  for (var i=0; i < buf.length; i++) {
    str += alphabet.charAt(buf[i] % alphabet.length);
  }

  return str;
}

exports.generate = function(chars, cb) {
  if (cb) {
    crypto.randomBytes(chars, function(ex, buf) {
      cb(bytesToChars(buf));
    });
  } else {
    return bytesToChars(crypto.randomBytes(chars));
  }
};

// we don't bother to make this async, cause it's not needed
exports.weakGenerate = function(chars) {
  var str = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i=0; i < chars; i++) {
    str += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  return str;
};

// functions to set defaults

// default key name is 'root'
function checkName(name) {
  return name ? name : 'root';
}

// default directory is the var dir.
function checkDir(dir) {
  return dir ? dir :  require('./configuration').get('var_path');
}

exports.hydrateSecret = function(name, dir) {
  dir = checkDir(dir);
  var p = path.join(dir, name + ".sekret");
  var secret;

  try{ secret = fs.readFileSync(p).toString(); } catch(e) {}

  if (secret === undefined) {
    secret = exports.generate(128);
    fs.writeFileSync(p, '');
    fs.chmodSync(p, '0600');
    fs.writeFileSync(p, secret);
  }
  return secret;
};

exports.loadSecretKey = function(name, dir) {
  name = checkName(name);
  dir = checkDir(dir);
  var p = path.join(dir, name + ".secretkey");
  var secret;

  // may throw
  secret = fs.readFileSync(p).toString();

  if (secret === undefined) {
    return null;
  }

  // parse it
  return jwcrypto.loadSecretKey(secret);
};

function readAndParseCert(name, dir) {
  name = checkName(name);
  dir = checkDir(dir);
  var p = path.join(dir, name + ".cert");
  var cert;

  // may throw
  cert = fs.readFileSync(p).toString();

  if (cert === undefined) {
    return null;
  }

  // parse it
  // it should be a JSON structure with alg and serialized key
  // {alg: <ALG>, value: <SERIALIZED_KEY>}
  var payloadSegment = jwcrypto.extractComponents(cert).payloadSegment;
  return JSON.parse(new Buffer(payloadSegment, 'base64').toString());
}

exports.publicKeyCreationDate = function(name, dir) {
  return new Date(readAndParseCert(name, dir).iat);
};

exports.loadPublicKey = function(name, dir) {
  var parsedCert = readAndParseCert(name, dir);
  var pkString = parsedCert['public-key'] || parsedCert.publicKey;
  return jwcrypto.loadPublicKey(JSON.stringify(pkString));
};
