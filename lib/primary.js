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

const HOSTNAME = urlparse(config.get('public_url')).host;

var g_shim_cache = {};

function parseWellKnownBody(body, domain) {
  var v = JSON.parse(body);

  const want = [ 'public-key', 'authentication', 'provisioning' ];
  var got = Object.keys(v);

  want.forEach(function(k) {
    if (-1 === got.indexOf(k)) throw "missing required key: " + k;
  });

  // Allow SHIMMED_PRIMARIES to change example.com into 127.0.0.1:10005
  var url_prefix = 'https://' + domain;
  if (g_shim_cache[domain]) {
    url_prefix = g_shim_cache[domain].origin;
  }

  var urls = {
    auth: url_prefix + v.authentication,
    prov: url_prefix + v.provisioning,
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

exports.checkSupport = function(domain, cb) {
  if (!cb) throw "missing required callback function";

  if (config.get('disable_primary_support')) {
    return process.nextTick(function() { cb(null, false); });
  }

  if (typeof domain !== 'string' || !domain.length) {
    return process.nextTick(function() { cb("invalid domain"); });
  }

  getWellKnown(domain, cb);
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
    g_shim_cache[domain] = {
      origin: origin,
      body: body
    };
    logger.info("inserted primary info for '" + domain + "' into cache, TODO point at '" + origin + "'");
  });
}

var getWellKnown = function (domain, cb) {
  function handleResponse(res) {
    var msg;
    if (res.statusCode !== 200) {
      logger.debug(' is not a browserid primary - non-200 response code to ' + WELL_KNOWN_URL);
      return cb("can't get public key for " + domain);
    }
    if (res.headers['content-type'].indexOf('application/json') !== 0) {
      msg = domain + ' is not a browserid primary - non "application/json" response to ' + WELL_KNOWN_URL
      logger.debug(msg);
      return cb(msg);
    }

    var body = "";
    res.on('data', function(chunk) { body += chunk; });
    res.on('end', function() {
      try {
        var r = parseWellKnownBody(body, domain);
        logger.info(domain + ' is a valid browserid primary');
        return cb(null, r.urls, r.publicKey);
      } catch(e) {
        msg = domain + ' is a broken browserid primary, malformed dec of support: ' + e.toString();
        logger.debug(msg);
        return cb(msg);
      }
    });
  };

  if (g_shim_cache[domain]) {
    var body = g_shim_cache[domain].body,
        r = parseWellKnownBody(body, domain);
    return cb(null, r.urls, r.publicKey);
  }

  // now we need to check to see if domain purports to being a primary
  // for browserid
  var httpProxy = config.has('http_proxy') ? config.get('http_proxy') : null;

  var req;
  if (httpProxy && httpProxy.port && httpProxy.host) {
    // In production we use Squid as a reverse proxy cache to reduce how often
    // we request this resource.
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
    var msg = domain + ' is not a browserid primary: ' + e.toString();
    logger.debug(msg);
    cb(msg);
  });
};

exports.getPublicKey = function(domain, cb) {
  exports.checkSupport(domain, function(err, urls, publicKey) {
    cb(err, publicKey);
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
      if (issuer === HOSTNAME) {
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
        var want = urlparse(config.get('public_url')).originOnly();
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
