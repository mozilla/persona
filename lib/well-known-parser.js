/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var jwcrypto = require("jwcrypto");

// parse a well-known document.  throw an exception if it is invalid, return
// a parsed version if it is valid.  return is an object having the following fields:
//   * 'type' - one of "disabled", "delegation", or "supported"
//   * if type is "delegation", also:
//     * authority - the domain authority is delegated to
//   * if type is "supported":
//     * publicKey - a parsed representation of the public key
//     * paths.authentication - the path to the 'authentication' html
//     * paths.provisioning - the path to the 'provisioning' html
module.exports = function(doc) {
  try {
    doc = JSON.parse(doc);
  } catch(e) {
    throw "declaration of support is malformed (invalid json)";
  }

  if (typeof doc !== 'object') {
    throw "support document must contain a json object";
  }

  // there are three main types of support documents
  // 1. "supported" - declares the domain is a browserid authority,
  //    contains public-key, authentication, and provisioning
  // 2. "delegation" - declares the domain allows a different domain
  //    to be authoritative for it.
  // 3. "disable" - domain declares explicitly that it wants a secondary
  //    to be authoritative.

  // is this a "disable" document?  Any value will cause the domain to
  // be disabled for the purposes of parsing.  For the purposes of the spec
  // we should insist on 'true'.  Rationale is that if disabled is present
  // in the file, the most likely intent is to DISABLE.
  if (doc.disabled) {
    return { type: "disabled" };
  }

  // is this a delegation document?
  if (doc.authority) {
    if (typeof doc.authority !== 'string') throw "malformed authority";

    return {
      type: "delegation",
      authority: doc.authority
    };
  }

  // is this a support document?

  // the response that we'll populate as we go
  var parsed = {
    type: "supported",
    paths: {},
    publicKey: null
  };

  [ 'authentication', 'provisioning' ].forEach(function(requiredKey) {
    if (typeof doc[requiredKey] !== 'string') {
      throw "support document missing required '" + requiredKey + "'";
    } else {
      parsed.paths[requiredKey] = doc[requiredKey];
    }
  });

  if (!doc['public-key']) {
    throw "support document missing required 'public-key'";
  }

  // can we parse that key?
  try {
    parsed.publicKey = jwcrypto.loadPublicKeyFromObject(doc['public-key']);
  } catch(e) {
    throw "mal-formed public key in support doc: " + e.toString();
  }

  // success!
  return parsed;
};
