/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// this file is an abstraction around "primary identity authority" support,
// specifically checks and a cache to see if a primary supports browserid
// natively.

const
https = require('https'),
http = require('http'),
logger = require('./logging.js').logger,
urlparse = require('urlparse'),
jwk = require('jwcrypto/jwk'),
jwcert = require("jwcrypto/jwcert"),
vep = require("jwcrypto/vep"),
jwt = require("jwcrypto/jwt"),
config = require("./configuration.js");

const WELL_KNOWN_URL = "/.well-known/browserid";

// cache .well-known/browserid for six hours
const MAX_CACHE_MS = (6 * 60 * 60 * 1000);

function parseWellKnownBody(body, domain) {
  var v = JSON.parse(body);

  const want = [ 'public-key', 'authentication', 'provisioning' ];
  var got = Object.keys(v);

  want.forEach(function(k) {
    if (-1 === got.indexOf(k)) throw "missing required key: " + k;
  });

  var urls = {
    auth: 'https://' + domain + v.authentication,
    prov: 'https://' + domain + v.provisioning,
  };

  // validate the urls
  urlparse(urls.auth).validate();
  urlparse(urls.prov).validate();

  // parse the public key
  return {
    publicKey: jwk.PublicKey.fromSimpleObject(v['public-key']),
    urls: urls
  };
}

// a cache of network responses.  We want to move this into
// fast and efficient external key/value storage as we scale
var g_cache = { };

exports.checkSupport = function(domain, cb) {
  if (!cb) throw "missing required callback function";

  if (config.get('disable_primary_support')) {
    return process.nextTick(function() { cb(null, false); });
  }

  if (typeof domain !== 'string' || !domain.length) {
    return process.nextTick(function() { cb("invalid domain"); });
  }

  // check cache age
  if (g_cache[domain]) {
    if (!g_cache[domain].when || (new Date() - g_cache[domain].when) > MAX_CACHE_MS) {
      delete g_cache[domain];
    }

    if (g_cache[domain]) {
      logger.debug("returning primary support status for '" + domain + "' from cache");
      return process.nextTick(function() { cb(null, g_cache[domain].status); });
    }
  }

  function cacheAndReturn(cacheValue, publicKey) {
    g_cache[domain] = {
      when: new Date(),
      status: cacheValue,
      publicKey: publicKey
    };
    cb(null, cacheValue);
  }

  function handleResponse(res) {
    if (res.statusCode !== 200) {
      logger.debug(domain + ' is not a browserid primary - non-200 response code to ' + WELL_KNOWN_URL);
      return cacheAndReturn(false);
    }
    if (res.headers['content-type'].indexOf('application/json') !== 0) {
      logger.debug(domain + ' is not a browserid primary - non "application/json" response to ' + WELL_KNOWN_URL);
      return cacheAndReturn(false);
    }

    var body = "";
    res.on('data', function(chunk) { body += chunk; });
    res.on('end', function() {
      try {
        var r = parseWellKnownBody(body, domain);
        logger.info(domain + ' is a valid browserid primary');
        return cacheAndReturn(r.urls, r.publicKey);
      } catch(e) {
        logger.debug(domain + ' is a broken browserid primary, malformed dec of support: ' + e.toString());
        return cacheAndReturn(false);
      }
    });
  };

  // now we need to check to see if domain purports to being a primary for browserid
  var httpProxy = config.get('http_proxy');

  var req;
  if (httpProxy && httpProxy.port && httpProxy.host) {
    req = http.get({
      host: httpProxy.host,
      port: httpProxy.port,
      path: 'https://' + domain + WELL_KNOWN_URL,
      headers: {
        host: domain
      }
    }, handleResponse);
  } else {
    req = https.get({
      host: domain,
      path: WELL_KNOWN_URL,
      agent: false
    }, handleResponse);
  }

  req.on('error', function(e) {
    logger.debug(domain + ' is not a browserid primary: ' + e.toString());
    cacheAndReturn(false);
  });
};

// Support "shimmed primaries" for local development.  That is an environment variable that is any number of
// CSV values of the form:
//  <domain>|<origin>|<path to .well-known/browserid>,
// where 'domain' is the domain that we would like to shim.  'origin' is the origin to which traffic should
// be directed, and 'path to .well-known/browserid' is a path to the browserid file for the domain
//
// defining this env var will pre-seed the cache so local testing can take place.  example:
//
// SHIMMED_PRIMARIES=eyedee.me|http://127.0.0.1:10005|example/primary/.well-known/browserid

if (process.env['SHIMMED_PRIMARIES']) {
  var shims = process.env['SHIMMED_PRIMARIES'].split(',');
  shims.forEach(function(shim) {
    var a = shim.split('|');
    var domain = a[0], origin = a[1], path = a[2];
    var body = require('fs').readFileSync(path);
    var r = parseWellKnownBody(body, domain);
    r.urls.auth = r.urls.auth.replace('https://' + domain, origin);
    r.urls.prov = r.urls.prov.replace('https://' + domain, origin);

    g_cache[domain] = {
      when: new Date(),
      status: r.urls,
      publicKey: r.publicKey
    };

    logger.info("inserted primary info for '" + domain + "' into cache, pointed at '" + origin + "'");
  });
}

exports.getPublicKey = function(domain, cb) {
  exports.checkSupport(domain, function(err, rv) {
    if (err) return cb(err);
    var pubKey;
    if (rv) pubKey = g_cache[domain].publicKey;
    if (!pubKey) return cb("can't get public key for " + domain);
    cb(null, pubKey);
  });
};

// verify an assertion generated to authenticate to browserid
exports.verifyAssertion = function(assertion, cb) {
  if (config.get('disable_primary_support')) {
    return process.nextTick(function() { cb("primary support disabled") });
  }

  try {
    var bundle = vep.unbundleCertsAndAssertion(assertion);
  } catch(e) {
    return process.nextTick(function() { cb("malformed assertion: " + e); });
  }

  jwcert.JWCert.verifyChain(
    bundle.certificates,
    new Date(), function(issuer, next) {
      // issuer cannot be the browserid
      if (issuer === config.get('hostname')) {
        cb("cannot authenticate to browserid with a certificate issued by it.");
      } else {
        exports.getPublicKey(issuer, function(err, pubKey) {
          if (err) return cb(err);
          next(pubKey);
        });
      }
    }, function(pk, principal) {
      try {
        var tok = new jwt.JWT();
        tok.parse(bundle.assertion);

        // audience must be browserid itself
        var want = urlparse(config.get('URL')).originOnly();
        var got = urlparse(tok.audience).originOnly();

        if (want.toString() !== got.toString()) {
          return cb("can't log in with an assertion for '" + got.toString() + "'");
        }
        if (!tok.verify(pk)) throw "verification failure";
        cb(null, principal.email);
      } catch(e) {
        cb("can't verify assertion: " + e.toString());
      }
    }, cb);
};
