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

const
path = require('path'),
fs = require('fs'),
jwk = require('jwcrypto/jwk'),
jwt = require('jwcrypto/jwt'),
Buffer = require('buffer').Buffer;


function randomBytes(length) {
  var buf = new Buffer(length);
  var fd = fs.openSync('/dev/urandom', 'r');
  fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  return buf;
}

exports.randomBytes = randomBytes;

exports.generate = function(chars) {
  var str = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  var bytes = randomBytes(chars);

  // yes, we are biasing the output here a bit.
  // I'm ok with that. We can improve this over time.
  for (var i=0; i < chars; i++) {
    str += alphabet.charAt(bytes[i] % alphabet.length);
  }
  
  return str;
}

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
  var secret = undefined;

  try{ secret = fs.readFileSync(p).toString(); } catch(e) {};

  if (secret === undefined) {
    secret = exports.generate(128);
    fs.writeFileSync(p, '');
    fs.chmodSync(p, 0600);
    fs.writeFileSync(p, secret);
  }
  return secret;
};

exports.loadSecretKey = function(name, dir) {
  name = checkName(name);
  dir = checkDir(dir);
  var p = path.join(dir, name + ".secretkey");
  var secret = undefined;

  // may throw
  secret = fs.readFileSync(p).toString();

  if (secret === undefined) {
    return null;
  }

  // parse it
  return jwk.SecretKey.deserialize(secret);
}

function readAndParseCert(name, dir) {
  name = checkName(name);
  dir = checkDir(dir);
  var p = path.join(dir, name + ".cert");
  var cert = undefined;

  // may throw
  cert = fs.readFileSync(p).toString();

  if (cert === undefined) {
    return null;
  }

  // parse it
  // it should be a JSON structure with alg and serialized key
  // {alg: <ALG>, value: <SERIALIZED_KEY>}
  var tok = new jwt.JWT();
  tok.parse(cert);
  return JSON.parse(new Buffer(tok.payloadSegment, 'base64').toString());
}

exports.publicKeyCreationDate = function(name, dir) {
  return new Date(readAndParseCert(name, dir).iat);
};

exports.loadPublicKey = function(name, dir) {
  return jwk.PublicKey.deserialize(JSON.stringify(readAndParseCert(name, dir)['public-key']));
};
