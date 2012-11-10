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

  // is this a "disable" document?
  if (doc.supported === 'false' || doc.supported === false) {
    return { type: "disabled" };
  }
  // if supported is an unknown value, we intentionally ignore it.  we are
  // liberal in what we accept, and allow things like supported: 'oh yeah!'
  // or supported: true

  // is this a delegation document?
  if (doc.authority && typeof doc.authority === 'string') {
    return {
      type: "delegation",
      authority: doc.authority
    };
  }
  // if a non-string authority is specified, we ignore it.

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
