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
 *      Ben Adida <benadida@mozilla.com>
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

//
// rewritten idassertion for certificates

const xml2js = require("xml2js/lib/xml2js"),
http = require("http"),
https = require("https"),
url = require("url"),
jwk = require("jwcrypto/jwk"),
jwt = require("jwcrypto/jwt"),
jwcert = require("jwcrypto/jwcert"),
vep = require("jwcrypto/vep"),
config = require("../configuration.js"),
logger = require("../logging.js").logger,
secrets = require('../secrets.js');

const HOSTMETA_URL = "/.well-known/host-meta";

var publicKeys = {};

try {
  const publicKey = secrets.loadPublicKey();
} catch(e){
  logger.error("can't read public key, exiting: " + e);
  setTimeout(function() { process.exit(1); }, 0);
}

publicKeys[config.get('hostname')] = publicKey;

logger.debug("pre-seeded public key cache with key for " +
             config.get('hostname'));

function https_complete_get(host, url, successCB, errorCB) {
  https.get({host: host,path: url}, function(res) {
    var allData = "";
    res.on('data', function(d) {
      allData += d;
    });

    res.on('end', function() {
      successCB(allData);
    });

  }).on('error', function(e) {
    logger.warn(e.toString());
    errorCB(e);
  });
}

// only over SSL
function retrieveHostPublicKey(host, successCB, errorCB) {
  logger.debug("attempting to fetching public key for " + host);

  // cached?
  var cached = publicKeys[host];
  if (cached) {
    logger.debug("public key for " + host + " returned from cache");
    return successCB(cached);
  }

  logger.debug("performing HTTP request to fetch public key from " + host);

  https_complete_get(host, HOSTMETA_URL, function(hostmeta) {
    // find the location of the public key
    var parser = new xml2js.Parser();

    parser.addListener('end', function(parsedDoc) {
      // FIXME do we need to check hm:Host?

      var pk_location = null;

      // get the public key location
      var links = parsedDoc["Link"];
      if (links instanceof Array) {
        for (var i in links) {
          var link = links[i];
          var rel = link["@"]["rel"];
          if (rel) {
            if (rel.toLowerCase() == "https://browserid.org/vocab#publicKey") {
              pk_location = link["@"]["href"];
              break;
            }
          }
        }
      }

      // if we don't have a pk
      if (!pk_location)
        return errorCB("no public key in host-meta");

      // go fetch the public key
      https_complete_get(host, pk_location, function(raw_pk) {
        // parse the key
        var pk = jwk.PublicKey.deserialize(raw_pk);

        // cache it
        publicKeys[host] = pk;

        return successCB(pk);
      });
    });

    parser.parseString(hostmeta);
  }, errorCB);
}

// compare two audiences:
//   *want* is what was extracted from the assertion (it's trusted, we
//   generated it!
//   *got* is what was provided by the RP, so depending on their implementation
//   it might be strangely formed.
function compareAudiences(want, got) {
  try {
    var checkHostOnly = false;

    // issue #82 - for a limited time, let's allow got to be sloppy and omit scheme
    // in which case we guess a scheme based on port
    if (!/^https?:\/\//.test(got)) {
      var x = got.split(':');
      var scheme = "http";
      if (x.length === 2 && x[1] === '443') scheme = "https";
      got = scheme + "://" + got;
      checkHostOnly = true;
    }

    // now parse and compare
    function normalizeParsedURL(u) {
      if (!u.port) u.port = u.protocol === 'https:' ? 443 : 80;
      return u;
    }

    want = normalizeParsedURL(url.parse(want));

    got = normalizeParsedURL(url.parse(got));

    if (checkHostOnly) return want.hostname === got.hostname;

    return (want.protocol === got.protocol &&
            want.hostname === got.hostname &&
            want.port == got.port);
  } catch(e) {
    return false;
  }
}

// verify the tuple certList, assertion, audience
//
// assertion is a bundle of the underlying assertion and the cert list
// audience is a web origin, e.g. https://foo.com or http://foo.org:81
//
// pkRetriever should be sent in only by code that really understands
// what it's doing, e.g. testing code.
function verify(assertion, audience, successCB, errorCB, pkRetriever) {
  // assertion is bundle
  var bundle = vep.unbundleCertsAndAssertion(assertion);

  var theIssuer;
  jwcert.JWCert.verifyChain(
    bundle.certificates,
    new Date(), function(issuer, next) {
      theIssuer = issuer;
      // allow other retrievers for testing
      if (pkRetriever)
        pkRetriever(issuer, next);
      else
        retrieveHostPublicKey(issuer, next, function(err) {next(null);});
    }, function(pk, principal) {
      // primary?
      if (theIssuer != config.get('hostname')) {
        // then the email better match the issuer
        if (!principal.email.match("@" + theIssuer + "$"))
          return errorCB();
      }

      var tok = new jwt.JWT();
      tok.parse(bundle.assertion);

      // audience must match!
      if (!compareAudiences(tok.audience, audience)) {
        logger.debug("verification failure, audience mismatch: '"
                     + tok.audience + "' != '" + audience + "'");
        return errorCB("audience mismatch");
      }

      if (tok.verify(pk)) {
        successCB(principal.email, tok.audience, tok.expires, theIssuer);
      } else {
        errorCB();
      }
    }, errorCB);
}


exports.retrieveHostPublicKey = retrieveHostPublicKey;
exports.verify = verify;
