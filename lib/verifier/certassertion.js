/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
http = require("http"),
https = require("https"),
url = require("url"),
jwcrypto = require("jwcrypto"),
config = require("../configuration.js"),
logger = require("../logging.js").logger,
secrets = require('../secrets.js'),
primary = require('../primary.js'),
urlparse = require('urlparse');

require("jwcrypto/lib/algs/ds");
require("jwcrypto/lib/algs/rs");

try {
  const publicKey = secrets.loadPublicKey();
  if (typeof publicKey !== 'object') throw "secrets.loadPublicKey() returns non-object, load failure";
} catch(e){
  logger.error("can't read public key, exiting: " + e);
  setTimeout(function() { process.exit(1); }, 0);
}

const HOSTNAME = urlparse(config.get('public_url')).host;
const UNVERIFIED_EMAIL = 'unverified-email';

logger.debug("This verifier will accept assertions issued by " + HOSTNAME);

// compare two audiences:
//   *want* is what was extracted from the assertion (it's trusted, we
//   generated it!
//   *got* is what was provided by the RP, so depending on their implementation
//   it might be strangely formed.
function compareAudiences(want, got) {
  function normalizeParsedURL(u) {
    // return string because url.parse returns string
    if (!u.port) u.port = u.protocol === 'https:' ? '443' : '80';
    return u;
  }

  try {
    var got_scheme, got_domain, got_port;

    // We allow the RP to provide audience in multiple forms (see issue #82).
    // The RP SHOULD provide full origin, but we allow these alternate forms for
    // some dude named Postel doesn't go postal.
    // 1. full origin 'http://rp.tld'
    // 1a. full origin with port 'http://rp.tld:8080'
    // 2. domain and port 'rp.tld:8080'
    // 3. domain only 'rp.tld'

    // case 1 & 1a
    // (app:// urls are seen on FirefoxOS desktop and possibly mobile)
    if (/^(?:https?|app):\/\//.test(got)) {
      var gu = normalizeParsedURL(url.parse(got));
      got_scheme = gu.protocol;
      got_domain = gu.hostname;
      got_port = gu.port;
    }
    // case 2
    else if (got.indexOf(':') !== -1) {
      var p = got.split(':');
      if (p.length !== 2) throw "malformed domain";
      got_domain = p[0];
      got_port = p[1];
    }
    // case 3
    else {
      got_domain = got;
    }
    if (!got_domain) throw "domain missing";

    // now parse "want" url
    want = normalizeParsedURL(url.parse(want));

    // compare the parts explicitly provided by the client
    if (got_scheme && got_scheme !== want.protocol) throw "scheme mismatch";
    if (got_port && got_port !== want.port) throw "port mismatch";
    if (got_domain !== want.hostname) throw "domain mismatch";

    return undefined;
  } catch(e) {
    return e.toString();
  }
}

// verify the tuple certList, assertion, audience
//
// assertion is a bundle of the underlying assertion and the cert list
// audience is a web origin, e.g. https://foo.com or http://foo.org:81
// forceIssuer is a hostname or `undefined` for normal BID protocol
// allowUnverified is boolean to check for email or unverified-email
function verify(assertion, audience, forceIssuer, allowUnverified, successCB, errorCB) {
  // assertion is bundle
  var ultimateIssuer,
      verified = true;

  jwcrypto.cert.verifyBundle(
    assertion,
    new Date(), function(issuer, next) {
      // update issuer with each issuer in the chain, so the
      // returned issuer will be the last cert in the chain
      ultimateIssuer = issuer;

      // allow other retrievers for testing
      if (issuer === HOSTNAME) return next(null, publicKey);
      else if (config.get('disable_primary_support')) {
        return errorCB("this verifier doesn't respect certs issued from domains other than: " +
                       HOSTNAME);
      } else if (issuer === forceIssuer) {
        if (config.get('forcible_issuers').indexOf(forceIssuer) === -1) {
          return errorCB("this verifier won't force issuer for " + forceIssuer);
        } else {
          return next(null, publicKey);
        }
      }

      // XXX: this network work happening inside a compute process.
      // if we have a large number of requests to auth assertions that require
      // keyfetch, this could theoretically hurt our throughput.  We could
      // move the fetch up into the browserid process and pass it into the
      // compute process at some point.

      // let's go fetch the public key for this host
      primary.getPublicKey(issuer, function(err, pubKey) {
        if (err) return errorCB(err);
        next(null, pubKey);
      });
    }, function(err, certParamsArray, payload, assertionParams) {
      if (err) return errorCB(err);

      // for now, to be extra safe, we don't allow cert chains
      if (certParamsArray.length > 1)
        return errorCB("certificate chaining is not yet allowed");

      // audience must match!
      err = compareAudiences(assertionParams.audience, audience);
      if (err) {
        logger.debug("verification failure, audience mismatch: '"
                     + assertionParams.audience + "' != '" + audience + "': " + err);
        return errorCB("audience mismatch: " + err);
      }

      // principal is in the last cert
      var principal = certParamsArray[certParamsArray.length - 1].certParams.principal;

      // unverified assertions are only valid if they are expected
      if (principal[UNVERIFIED_EMAIL] && !allowUnverified) {
        return errorCB("unverified email");
      }

      // verify that the issuer is the same as the email domain or
      // that the email's domain delegated authority to the issuer
      var email = principal.email;
      if (allowUnverified && !email) {
        email = principal[UNVERIFIED_EMAIL];
        verified = false;
      }
      
      if (!email) {
        return errorCB("missing email");
      }

      var domainFromEmail = primary.domainFromEmail(email);

      if (ultimateIssuer !== HOSTNAME &&
          ultimateIssuer !== domainFromEmail &&
          ultimateIssuer !== forceIssuer)
      {
          primary.delegatesAuthority(domainFromEmail, ultimateIssuer, function (delegated) {
            if (delegated) {
              return successCB(email, assertionParams.audience, assertionParams.expiresAt, ultimateIssuer, verified);
            } else {
              return errorCB("issuer '" + ultimateIssuer + "' may not speak for emails from '"
                         + domainFromEmail + "'");
            }
          });
      } else {
        return successCB(email, assertionParams.audience, assertionParams.expiresAt, ultimateIssuer, verified);
      }
    }, errorCB);
}

exports.compareAudiences = compareAudiences;
exports.verify = verify;
