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
secrets = require('../secrets'),
version = require('../version'),
querystring = require('querystring');

require("jwcrypto/lib/algs/rs");

// the underbar decorator to allow getext to extract strings
function _(str) { return str; }

// all templated content, redirects, and renames are handled here.
// anything that is not an api, and not static
const
path = require('path');

const VIEW_PATH = path.join(__dirname, "..", "..", "resources", "views");

// none of our views include dynamic data.  all of them should be served
// with reasonable cache headers.  This wrapper around rendering handles
// cache headers maximally leveraging the same logic that connect uses
// issue #910

function cacheAllTheThings(res) {
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
}

function renderCachableView(req, res, template, options) {
  cacheAllTheThings(res);
  res.setHeader('Content-Type', 'text/html; charset=utf8');

  options.enable_development_menu = config.get('enable_development_menu');

  // The real version number is not ready until sometime after initial load,
  // until it is ready a fake randomly generated string is used. Go get
  // the real SHA whenever it is actually needed so that the randomly
  // generated SHA is not returned to the user.
  options.commit = version();

  res.local('util', util);
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
      req.url = "/production/include.js";
    }

    next();
  });

  app.get('/include.orig.js', function(req, res, next) {
    req.url = "/include_js/include.js";
    next();
  });

  // this should probably be an internal redirect
  // as soon as relative paths are figured out.
  app.get('/sign_in', function(req, res) {
    renderCachableView(req, res, 'dialog.ejs', {
      title: _('A Better Way to Sign In'),
      layout: 'dialog_layout.ejs',
      useJavascript: true,
      measureDomLoading: config.get('measure_dom_loading'),
      production: config.get('use_minified_resources')
    });
  });

  app.get('/communication_iframe', function(req, res) {
    renderCachableView(req, res, 'communication_iframe.ejs', {
      layout: false,
      production: config.get('use_minified_resources')
    });
  });

  app.get("/unsupported_dialog", function(req,res) {
    renderCachableView(req, res, 'unsupported_dialog.ejs', {
      title: _('Unsupported Browser'),
      layout: 'dialog_layout.ejs',
      useJavascript: false,
      // without the javascript bundle, there is no point in measuring the
      // window opened time.
      measureDomLoading: false
    });
  });

  app.get("/cookies_disabled", function(req,res) {
    renderCachableView(req, res, 'cookies_disabled.ejs', {
      title: _('Cookies Are Disabled'),
      layout: 'dialog_layout.ejs',
      useJavascript: false,
      // without the javascript bundle, there is no point in measuring the
      // window opened time.
      measureDomLoading: false
    });
  });

  // Used for a relay page for communication.
  app.get("/relay", function(req, res) {
    renderCachableView(req, res, 'relay.ejs', {
      layout: false,
      production: config.get('use_minified_resources')
    });
  });

  app.get("/authenticate_with_primary", function(req,res) {
    renderCachableView(req, res, 'authenticate_with_primary.ejs', { layout: false });
  });

  app.get('/', function(req,res) {
    renderCachableView(req, res, 'index.ejs', {title: _('A Better Way to Sign In'), fullpage: true});
  });

  app.get("/idp_auth_complete", function(req, res) {
    renderCachableView(req, res, 'idp_auth_complete.ejs', {
      title: _('Sign In Complete'),
      fullpage: false
    });
  });

  app.get("/forgot", function(req, res) {
    res.local('util', util);
    renderCachableView(req, res, 'forgot.ejs', {
      title: _('Forgot Password'),
      fullpage: false,
      enable_development_menu: config.get('enable_development_menu')
    });
  });

  app.get("/signup", function(req, res) {
    res.header('Location', '/signin');
    res.send(301);
  });

  app.get("/signin", function(req, res) {
    renderCachableView(req, res, 'signin.ejs', {title: _('Sign In'), fullpage: false});
  });

  app.get("/about", function(req, res) {
    renderCachableView(req, res, 'about.ejs', {title: _('About'), fullpage: false});
  });

  app.get("/tos", function(req, res) {
    renderCachableView(req, res, 'tos.ejs', {title: _('Terms of Service'), fullpage: false});
  });

  app.get("/privacy", function(req, res) {
    renderCachableView(req, res, 'privacy.ejs', {title: _('Privacy Policy'), fullpage: false});
  });

  app.get("/verify_email_address", function(req, res) {
    res.local('util', util);
    renderCachableView(req, res, 'verify_email_address.ejs', {
      title: _('Complete Registration'),
      fullpage: true,
      enable_development_menu: config.get('enable_development_menu')
    });
  });

  // This page can be removed a couple weeks after this code ships into production,
  // we're leaving it here to not break outstanding emails
  app.get("/add_email_address", function(req,res) {
    renderCachableView(req, res, 'confirm.ejs', {title: _('Verify Email Address'), fullpage: false});
  });


  app.get("/reset_password", function(req,res) {
    renderCachableView(req, res, 'confirm.ejs', {title: _('Reset Password')});
  });

  app.get("/confirm", function(req,res) {
    renderCachableView(req, res, 'confirm.ejs', {title: _('Confirm Email')});
  });

  var humans = fs.readFileSync(path.join(__dirname, "..", "..", "CONTRIBUTORS")).toString();
  app.get("/humans.txt", function(req, res) {
    cacheAllTheThings(res);
    res.setHeader('Content-Type', 'text/plain; charset=utf8');
    res.send(humans);
  });



  // serve up testing templates.  but NOT in staging or production.  see GH-1044
  if ([ 'https://login.persona.org', 'https://login.anosrep.org' ].indexOf(config.get('public_url')) === -1) {
    // serve test.ejs to /test or /test/ or /test/index.html
    app.get(/^\/test\/(?:index.html)?$/, function (req, res) {
      res.render('test.ejs', {title: 'Mozilla Persona QUnit Test', layout: false});
    });

    // l10n test template
    var testPath = path.join(__dirname, '..', '..', 'tests', 'i18n_test_templates');
    app.get('/i18n_test', function(req, res) {
      renderCachableView(req, res, path.join(testPath, 'i18n_test.ejs'), { layout: false, title: 'l10n testing title' });
    });
    app.get('/i18n_fallback_test', function(req, res) {
      renderCachableView(req, res, path.join(testPath, 'i18n_fallback_test.ejs'), { layout: false, title: 'l10n testing title' });
    });

    // /common/js/templates.js is dynamically built each time
    var templates = require('../templates');
    var dialogTemplatesPath = path.join(__dirname, '../../resources/static/dialog/views');
    app.get('/common/js/templates.js', function(req, res) {
      res.send(templates.generate(dialogTemplatesPath));
    });

    var siteTemplatesPath = path.join(__dirname, "../../resources/views");
    var sitePartialTemplatesPath = path.join(__dirname, "../../resources/views/partial");
    app.get('/test/mocks/site-templates.js', function(req, res) {
      // combine main templates and partials into one big set for development
      // mode.
      var siteTemplates = templates.generate(siteTemplatesPath, "site/");
      siteTemplates += templates.generate(sitePartialTemplatesPath, "partial/");
      res.send(siteTemplates);
    });

  } else {
    // this is stage or production, explicitly disable all resources under /test
    app.get(/^\/test/, function(req, res) {
      httputils.notFound(res, "Cannot " + req.method + " " + req.url);
    });
  }

  // REDIRECTS
  const REDIRECTS = {
    "/developers" : "https://developer.mozilla.org/docs/persona"
  };

  function redirect(from, to) {
    app.get(from, function(req, res) {
      res.redirect(to);
    });
  }

  // set up all the redirects
  for (var rUrl in REDIRECTS) {
    redirect(rUrl, REDIRECTS[rUrl]);
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

  // the "declaration of support" style publishing of the public key
  // or delegation to bigtent.
  // login.persona.org is a (uh, THE) secondary, it should publish its key
  // in a manner that is symmetric with how primaries do.  At present,
  // the absence of 'provisioning' and 'authentication' keys indicates
  // that this is a secondary, and verifiers should only trust
  // login.persona.org as a secondary (and anyone else they decide to for
  // whatever reason).
  app.get("/.well-known/browserid", function(req, res) {
      //var url = require('url'); // url is getting clobbered?
      var qs = querystring.parse(
                 url.parse(req.originalUrl).query);
      var domain = qs.domain || '';
      var proxyIdps = config.get('proxy_idps');
      // Can we delegate authority to BigTent?
      if (proxyIdps[domain]) {
        res.json({ 'authority': proxyIdps[domain] });
      // Be a Secondary
      } else {
        res.json({ 'public-key': publicKey.toSimpleObject() });
      }
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
