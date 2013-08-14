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
jwcrypto = require("jwcrypto"),
config = require("./configuration.js"),
primaryTimeout = config.get('declaration_of_support_timeout_ms'),
secrets = require("./secrets.js"),
events = require("events"),
wellKnownParser = require('./well-known-parser.js');

// alg
require("jwcrypto/lib/algs/rs");
require("jwcrypto/lib/algs/ds");

const WELL_KNOWN_URL = "/.well-known/browserid";

// Protect from stack overflows and network DDOS attacks
const MAX_AUTHORITY_DELEGATIONS = 6;

const HOSTNAME = urlparse(config.get('public_url')).host;

var g_shim_cache = {};

// the event emitter will raise "idp_seen" events when we sucessfully
// check an IdP's well-known hosts file and see that they are online
exports.events = new events.EventEmitter();

try {
  const PUBLIC_KEY = secrets.loadPublicKey();
  if (typeof PUBLIC_KEY !== 'object') throw "secrets.loadPublicKey() returns non-object, load failure";
} catch(e) {
  logger.error("can't read public key, exiting: " + e);
  setTimeout(function() { process.exit(1); }, 0);
}

// Support "shimmed primaries" for local development.  That is an environment variable that is any number of
// CSV values of the form:
//  <domain>|<origin>|<path to .well-known/browserid>,
// where 'domain' is the domain that we would like to shim.  'origin' is the origin to which traffic should
// be directed, and 'path to .well-known/browserid' is a path to the browserid file for the domain
//
// defining this env var will pre-seed the cache so local testing can take place.  example:
//
// SHIMMED_PRIMARIES=eyedee.me|http://127.0.0.1:10005|example/primary/.well-known/browserid

if (process.env.SHIMMED_PRIMARIES) {
  var shims = process.env.SHIMMED_PRIMARIES.split(',');
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

// create delegation of authority documents for our proxyIDPs at the time this file is loaded
const PROXIED_DOMAINS = {};
if (config.has('proxy_idps')) {
  var pidps = config.get('proxy_idps');
  Object.keys(pidps).forEach(function(idp) {
    PROXIED_DOMAINS[idp] = {
      authority: pidps[idp]
    };
  });
}

// hit the network and fetch a .well-known document in its unparsed form
var fetchWellKnown = function (currentDomain, principalDomain, clientCB) {
  // in many cases the http layer can send both an 'error' and an 'end'.  In
  // other cases, only 'error' will be emitted.  We want to
  // ensure the client callback is invoked only once.  this function does it.
  var cb = function() {
    if (clientCB) {
      clientCB.apply(null, arguments);
      clientCB = null;
    }
  };

  // if a network attempt to retrieve a support document from the principal
  // domain fails, let's see if we have a "proxy" IDP available for this domain,
  // if so, we'll create a delegation of authority document.
  function handleProxyIDP(err) {
    // log the error with the inital fetch if defined
    if (err) logger.debug(err);

    if (PROXIED_DOMAINS[currentDomain]) {
      cb(null, JSON.stringify(PROXIED_DOMAINS[currentDomain]));
    } else {
      cb(err);
    }
  }

  function handleResponse(res) {
    if (res.statusCode !== 200) {
      return handleProxyIDP(currentDomain +
                            ' is not a browserid primary - non-200 response code to ' +
                            WELL_KNOWN_URL);
    }
    var contentType = res.headers['content-type'];
    if (!contentType || contentType.indexOf('application/json') !== 0) {
      return handleProxyIDP(currentDomain +
                            ' is not a browserid primary - non "application/json" response to ' +
                            WELL_KNOWN_URL);
    }

    var body = "";
    res.on('data', function(chunk) { body += chunk; });
    res.on('end', function() {
      cb(null, body, currentDomain);
    });
  }

  // if the domain is "shimmed" (for testing), then return a local document
  // as if it were fetched from the network.
  if (g_shim_cache[currentDomain]) {
    return cb(null, g_shim_cache[currentDomain].body, currentDomain);
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
      path: 'https://' + currentDomain + WELL_KNOWN_URL + "?domain=" + principalDomain,
      agent: false,
      headers: {
        host: currentDomain
      }
    }, handleResponse);
  } else {
    req = https.get({
      host: currentDomain,
      path: WELL_KNOWN_URL + "?domain=" + principalDomain,
      rejectUnauthorized: true,
      agent: false
    }, handleResponse);
  }

  // front-end shows xhr delay message after 10 sec; timeout sooner to avoid this
  var reqTimeout = setTimeout(function() {
    req.abort();
    handleProxyIDP('timeout trying to load well-known for ' + currentDomain);
  }, primaryTimeout);
  req.on('response', function() { clearTimeout(reqTimeout); });

  req.on('error', function(e) {
    if (reqTimeout) { clearTimeout(reqTimeout); }
    handleProxyIDP(currentDomain + ' is not a browserid primary: ' + String(e));
  });
};

// Fetch a .well-known file from the network, following delegation
function deepFetchWellKnown(principalDomain, cb, currentDomain, delegationChain) {
  // this function is recursive, the last two parameters are only specified
  // when invoking ourselves.
  if (!currentDomain) currentDomain = principalDomain;
  if (!delegationChain) delegationChain = [ principalDomain ];

  fetchWellKnown(currentDomain, principalDomain, function(err, unparsedDoc) {
    if (err) return cb(err);

    var supportDoc;
    try {
      supportDoc = wellKnownParser(unparsedDoc);
    } catch (e) {
      return cb("bad support document for '" + currentDomain + "': " + String(e));
    }

    if (supportDoc.type === 'disabled')
    {
      return cb(null, {
        disabled: true,
        delegationChain: delegationChain,
        authoritativeDomain: delegationChain[delegationChain.length - 1],
      });
    }
    else if (supportDoc.type === 'delegation')
    {
      currentDomain = supportDoc.authority;

      // check for cycles in delegation
      if (delegationChain.indexOf(currentDomain) !== -1) {
        return cb("Circular reference in delegating authority: " + delegationChain.join(" > "));
      }

      delegationChain.push(currentDomain);

      logger.debug(delegationChain[delegationChain.length - 2] + " delegates to " +
                   delegationChain[delegationChain.length - 1]);

      // check for max delegation length
      if (delegationChain.length > MAX_AUTHORITY_DELEGATIONS) {
        return cb("Too many hops while delegating authority: " + delegationChain.join(" > "));
      }

      // recurse
      return deepFetchWellKnown(principalDomain, cb, currentDomain, delegationChain);
    }
    else if (supportDoc.type === 'supported')
    {
      // DEBUGGING INSTRUMENTATION: Allow SHIMMED_PRIMARIES to change example.com into 127.0.0.1:10005
      var url_prefix = 'https://' + currentDomain;
      if (g_shim_cache[currentDomain]) {
        url_prefix = g_shim_cache[currentDomain].origin;
      }

      var details = {
        publicKey: supportDoc.publicKey,
        urls: {
          auth: url_prefix + supportDoc.paths.authentication,
          prov: url_prefix + supportDoc.paths.provisioning
        },
        delegationChain: delegationChain,
        authoritativeDomain: delegationChain[delegationChain.length - 1],
        proxied: !!PROXIED_DOMAINS[principalDomain]
      };

      // validate the urls
      try {
        urlparse(details.urls.auth).validate();
        urlparse(details.urls.prov).validate();
      } catch(e) {
        return cb("invalid URLs in support document: " + e.toString());
      }

      // success!
      cb(null, details);
    }
    else
    {
      var msg = "unhandled error while parsing support document for " + currentDomain;
      logger.error(msg);
      return cb(msg);
    }
  });
}

exports.checkSupport = function(principalDomain, cb) {
  if (!cb) throw "missing required callback function";

  if (config.get('disable_primary_support')) {
    return process.nextTick(function() { cb(null, false); });
  }

  if (typeof principalDomain !== 'string' || !principalDomain.length) {
    return process.nextTick(function() { cb("invalid domain"); });
  }

  deepFetchWellKnown(principalDomain, function (err, r) {
    if (err) {
      logger.debug(err);
      cb(err);
    } else if (r) {
      if (r.disabled) {
        // Don't emit events for disabled idps.  This could be very noisy.  Rather
        // we perform a lazy cleanup of stale database records inside address_info.
        logger.info(principalDomain + ' has explicitly disabled browserid support');
      } else {
        exports.events.emit("idp_seen", principalDomain);
        logger.info(principalDomain + ' is a valid browserid primary');
      }
      return cb(null, r);
    }
  });
};

const EMAIL_REGEX = /\@(.*)$/;

exports.getPublicKey = function(domain, cb) {
  exports.checkSupport(domain, function(err, r) {
    if (err || !r || !r.publicKey) {
      cb("can't get public key for " + domain + (err ? ": " + err : ""));
    } else {
      cb(err, r.publicKey);
    }
  });
};

// Is issuingDomain allowed to issue certifications for emails from
// emailDomain.
exports.delegatesAuthority = function (emailDomain, issuingDomain, cb) {
  exports.checkSupport(emailDomain, function(err, r) {
    cb(!err && r && (r.authoritativeDomain === issuingDomain));
  });
};

// verify an assertion generated to authenticate to browserid
exports.verifyAssertion = function(assertion, cb) {
  if (config.get('disable_primary_support')) {
    return process.nextTick(function() { cb("primary support disabled"); });
  }

  var rootIssuer;
  var getRoot = function(issuer, next) {
    // allow assertions rooted in certs issued by us.  this occurs in the proxy_idp case
    // where we sign assertions for other domains.
    rootIssuer = issuer; // remember for policy check later
    if (issuer === HOSTNAME) {
      next(null, PUBLIC_KEY);
    } else {
      exports.getPublicKey(issuer, function(err, pubKey) {
        if (err) return next(err);
        next(null, pubKey);
      });
    }
  };

  // verify the assertion bundle
  var now = new Date();
  jwcrypto.cert.verifyBundle(assertion, now, getRoot, function(err, certParamsArray, payload, assertionParams) {
    if (err) return cb(err);

    // for now, to be extra safe, we don't allow cert chains
    if (certParamsArray.length > 1)
      return cb("certificate chaining is not yet allowed");

    // audience must be browserid itself
    var want = urlparse(config.get('public_url')).originOnly();
    var got = urlparse(assertionParams.audience).originOnly();

    if (want.toString() !== got.toString()) {
      return cb("can't log in with an assertion for '" + got.toString() + "'");
    }

    // principal is in the last cert
    var principal = certParamsArray[certParamsArray.length - 1].certParams.principal;
    var domainFromEmail = exports.domainFromEmail(principal.email);

    if (rootIssuer !== domainFromEmail)
    {
      exports.delegatesAuthority(domainFromEmail, rootIssuer, function (delegated) {
        if (delegated) {
          cb(null, principal.email);
        } else {
          return cb("issuer '" + rootIssuer + "' may not speak for emails from '"
                    + domainFromEmail + "'");
        }
      });
    } else {
      // all is well, get the principal from the last cert
      cb(null, principal.email);
    }
  });
};

exports.domainFromEmail = function domainFromEmail(email) {
  return EMAIL_REGEX.exec(email)[1].toLowerCase();
};
