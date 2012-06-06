/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
metrics = require('../metrics.js'),
url = require('url'),
logger = require('../logging.js').logger,
fs = require('fs'),
connect = require('connect'),
config = require('../configuration.js'),
und = require('underscore'),
util = require('util'),
httputils = require('../httputils.js'),
etagify = require('etagify'),
secrets = require('../secrets');

// all templated content, redirects, and renames are handled here.
// anything that is not an api, and not static
const
path = require('path');

const VIEW_PATH = path.join(__dirname, "..", "..", "resources", "views");

// none of our views include dynamic data.  all of them should be served
// with reasonable cache headers.  This wrapper around rendering handles
// cache headers maximally leveraging the same logic that connect uses
// issue #910
function renderCachableView(req, res, template, options) {
  if (config.get('env') !== 'local') {
    // allow caching, but require revalidation via ETag
    res.etagify();
    res.setHeader('Cache-Control', 'public, max-age=0');
  } else {
    // disable all caching for local dev
    res.setHeader('Cache-Control', 'no-store');
  }
  res.setHeader('Date', new Date().toUTCString());
  res.setHeader('Vary', 'Accept-Encoding,Accept-Language');
  res.setHeader('Content-Type', 'text/html; charset=utf8');
  res.render(template, options);
}

exports.setup = function(app) {

  // Issue#1353 This is kind of dirty, but this is our last chance
  // to fixup headers for an ETag cache hit
  // x-frame-options - Allow these to be run within a frame
  app.use(function (req, res, next) {
    if (req.path === '/communication_iframe') {
      res.removeHeader('x-frame-options');
    } else if (req.path === '/relay') {
      res.removeHeader('x-frame-options');
    }
    next();
  });

  // Caching for dynamic resources
  app.use(etagify());

  app.set("views", VIEW_PATH);

  app.set('view options', {
    production: config.get('use_minified_resources')
  });

  app.get('/include.js', function(req, res, next) {
    req.url = "/include_js/include.js";

    if (config.get('use_minified_resources') === true) {
      req.url = "/production/include.js"
    }

    next();
  });

  app.get('/include.orig.js', function(req, res, next) {
    req.url = "/include_js/include.js";
    next();
  });

  // this should probably be an internal redirect
  // as soon as relative paths are figured out.
  app.get('/sign_in', function(req, res, next ) {
    metrics.userEntry(req);
    renderCachableView(req, res, 'dialog.ejs', {
      title: 'A Better Way to Sign In',
      layout: 'dialog_layout.ejs',
      useJavascript: true,
      production: config.get('use_minified_resources')
    });
  });

  app.get('/communication_iframe', function(req, res, next ) {

    renderCachableView(req, res, 'communication_iframe.ejs', {
      layout: false,
      production: config.get('use_minified_resources')
    });
  });

  app.get("/unsupported_dialog", function(req,res) {
    renderCachableView(req, res, 'unsupported_dialog.ejs', {layout: 'dialog_layout.ejs', useJavascript: false});
  });

  app.get("/cookies_disabled", function(req,res) {
    renderCachableView(req, res, 'cookies_disabled.ejs', {layout: 'dialog_layout.ejs', useJavascript: false});
  });

  // Used for a relay page for communication.
  app.get("/relay", function(req, res, next) {
    renderCachableView(req, res, 'relay.ejs', {
      layout: false,
      production: config.get('use_minified_resources')
    });
  });

  app.get("/authenticate_with_primary", function(req,res, next) {
    renderCachableView(req, res, 'authenticate_with_primary.ejs', { layout: false });
  });

  app.get('/', function(req,res) {
    renderCachableView(req, res, 'index.ejs', {title: 'A Better Way to Sign In', fullpage: true});
  });

  app.get("/signup", function(req, res) {
    renderCachableView(req, res, 'signup.ejs', {title: 'Sign Up', fullpage: false});
  });

  app.get("/idp_auth_complete", function(req, res) {
    renderCachableView(req, res, 'idp_auth_complete.ejs', {
      title: 'Sign In Complete',
      fullpage: false
    });
  });

  app.get("/forgot", function(req, res) {
    // !cachable!  email embedded in DOM
    res.render('forgot.ejs', {title: 'Forgot Password', fullpage: false, email: req.query.email});
  });

  app.get("/signin", function(req, res) {
    renderCachableView(req, res, 'signin.ejs', {title: 'Sign In', fullpage: false});
  });

  app.get("/about", function(req, res) {
    renderCachableView(req, res, 'about.ejs', {title: 'About', fullpage: false});
  });

  app.get("/tos", function(req, res) {
    renderCachableView(req, res, 'tos.ejs', {title: 'Terms of Service', fullpage: false});
  });

  app.get("/privacy", function(req, res) {
    renderCachableView(req, res, 'privacy.ejs', {title: 'Privacy Policy', fullpage: false});
  });

  app.get("/verify_email_address", function(req, res) {
    // !cachable!  token is embedded in DOM
    res.render('verify_email_address.ejs', {title: 'Complete Registration', fullpage: true, token: req.query.token});
  });

  app.get("/add_email_address", function(req,res) {
    renderCachableView(req, res, 'add_email_address.ejs', {title: 'Verify Email Address', fullpage: false});
  });

  // serve up testing templates.  but NOT in staging or production.  see GH-1044
  if ([ 'https://browserid.org', 'https://diresworb.org' ].indexOf(config.get('public_url')) === -1) {
    // serve test.ejs to /test or /test/ or /test/index.html
    app.get(/^\/test\/(?:index.html)?$/, function (req, res) {
      res.render('test.ejs', {title: 'BrowserID QUnit Test', layout: false});
    });
  } else {
    // this is stage or production, explicitly disable all resources under /test
    app.get(/^\/test/, function(req, res) {
      httputils.notFound("Cannot " + req.method + " " + req.url);
    });
  }

  // REDIRECTS
  REDIRECTS = {
    "/manage": "/",
    "/users": "/",
    "/users/": "/",
    "/primaries" : "/developers",
    "/primaries/" : "/developers",
    "/developers" : "https://github.com/mozilla/browserid/wiki/How-to-Use-BrowserID-on-Your-Site"
  };

  // set up all the redirects
  // oh my watch out for scope issues on var url - closure time
  for (var url in REDIRECTS) {
    (function(from,to) {
      app.get(from, function(req, res) {
        res.redirect(to);
      });
    })(url, REDIRECTS[url]);
  }

  try {
    const publicKey = secrets.loadPublicKey();
  } catch(e){
    logger.error("can't read public key, exiting: " + e);
    process.nextTick(function() { process.exit(1); });
  }

  // the public key (This location is DEPRECATED)
  app.get("/pk", function(req, res) {
    res.json(publicKey.toSimpleObject());
  });

  // the "declaration of support" style publishing of the public key.
  // BrowserID.org is a (uh, THE) secondary, it should publish its key
  // in a manner that is symmetric with how primaries do.  At present,
  // the absence of 'provisioning' and 'authentication' keys indicates
  // that this is a secondary, and verifiers should only trust
  // browserid.org as a secondary (and anyone else they decide to for
  // whatever reason).
  app.get("/.well-known/browserid", function(req, res) {
    res.json({ 'public-key': publicKey.toSimpleObject() });
  });

  // now for static redirects for cach busting - issue #225
  var versionRegex = /^(\/production\/[a-zA-Z\-]+)_v[a-zA-Z0-9]{7}(\.(?:css|js))$/;
  app.use(function(req, res, next) {
    var m = versionRegex.exec(req.url);
    if (m) {
      var newURL = m[1] + m[2];
      logger.debug('internal redirect of ' + req.url + ' to ' + newURL);
      req.url = newURL;
    }
    next();
  });
};
