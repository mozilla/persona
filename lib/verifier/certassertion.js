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

const
http = require("http"),
https = require("https"),
url = require("url"),
jwk = require("jwcrypto/jwk"),
jwt = require("jwcrypto/jwt"),
jwcert = require("jwcrypto/jwcert"),
vep = require("jwcrypto/vep"),
config = require("../configuration.js"),
logger = require("../logging.js").logger,
secrets = require('../secrets.js'),
primary = require('../primary.js');

try {
  const publicKey = secrets.loadPublicKey();
  if (typeof publicKey !== 'object') throw "secrets.loadPublicKey() returns non-object, load failure";
} catch(e){
  logger.error("can't read public key, exiting: " + e);
  setTimeout(function() { process.exit(1); }, 0);
}

logger.debug("This verifier will accept assertions issued by " + config.get('hostname'));

// compare two audiences:
//   *want* is what was extracted from the assertion (it's trusted, we
//   generated it!
//   *got* is what was provided by the RP, so depending on their implementation
//   it might be strangely formed.
function compareAudiences(want, got) {
  function normalizeParsedURL(u) {
    if (!u.port) u.port = u.protocol === 'https:' ? 443 : 80;
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
    if (/^https?:\/\//.test(got)) {
      var gu = normalizeParsedURL(url.parse(got));
      got_scheme = gu.protocol;
      got_domain = gu.hostname;
      got_port = gu.port;
    }
    // case 2
    else if (got.indexOf(':') != -1) {
      var p = got.split(':');
      if (p.length !== 2) throw "malformed domain";
      got_domain = p[0];
      got_port = p[1];
    }
    // case 3
    else {
      got_domain = got;
    }

    // now parse "want" url
    want = normalizeParsedURL(url.parse(want));

    // compare the parts explicitly provided by the client
    if (got_scheme && got_scheme != want.protocol) throw "scheme mismatch"
    if (got_port && got_port != want.port) throw "port mismatch"
    if (got_domain && got_domain != want.hostname) throw "domain mismatch"

    return undefined;
  } catch(e) {
    return e.toString();
  }
}

// verify the tuple certList, assertion, audience
//
// assertion is a bundle of the underlying assertion and the cert list
// audience is a web origin, e.g. https://foo.com or http://foo.org:81
function verify(assertion, audience, successCB, errorCB) {
  // assertion is bundle
  try {
    var bundle = vep.unbundleCertsAndAssertion(assertion);
  } catch(e) {
    return errorCB("malformed assertion");
  }

  var ultimateIssuer;

  jwcert.JWCert.verifyChain(
    bundle.certificates,
    new Date(), function(issuer, next) {
      // update issuer with each issuer in the chain, so the
      // returned issuer will be the last cert in the chain
      ultimateIssuer = issuer;

      // allow other retrievers for testing
      if (issuer === config.get('hostname')) return next(publicKey);
      else if (config.get('disable_primary_support')) {
        return errorCB("this verifier doesn't respect certs issued from domains other than: " +
                       config.get('hostname'));
      }

      // XXX: this network work happening inside a compute process.
      // if we have a large number of requests to auth assertions that require
      // keyfetch, this could theoretically hurt our throughput.  We could
      // move the fetch up into the browserid process and pass it into the
      // compute process at some point.

      // let's go fetch the public key for this host
      primary.getPublicKey(issuer, function(err, pubKey) {
        if (err) return errorCB(err);
        next(pubKey);
      });
    }, function(pk, principal) {
      var tok = new jwt.JWT();
      tok.parse(bundle.assertion);

      // audience must match!
      var err = compareAudiences(tok.audience, audience)
      if (err) {
        logger.debug("verification failure, audience mismatch: '"
                     + tok.audience + "' != '" + audience + "': " + err);
        return errorCB("audience mismatch: " + err);
      }

      // verify that the issuer is the same as the email domain
      // NOTE: for "delegation of authority" support we'll need to make this check
      // more sophisticated
      var domainFromEmail = principal.email.replace(/^.*@/, '');
      if (ultimateIssuer != config.get('hostname') && ultimateIssuer !== domainFromEmail)
      {
        return errorCB("issuer issue '" + ultimateIssuer + "' may not speak for emails from '"
                       + domainFromEmail + "'");
      }

      if (tok.verify(pk)) {
        successCB(principal.email, tok.audience, tok.expires, ultimateIssuer);
      } else {
        errorCB("verification failure");
      }
    }, errorCB);
};

exports.verify = verify;
