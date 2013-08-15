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
i18n = require('i18n-abide'),
secrets = require('../secrets'),
version = require('../version'),
querystring = require('querystring'),
generate_version_js = require('../generate_code_version');

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
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
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

  // Get the SHA associated with this code.
  version(function(commit) {
    options.commit = commit;

    res.local('util', util);
    res.render(template, options);
  });
}


function isProductionEnvironment() {
  return [
      'https://login.persona.org',
      'https://login.anosrep.org'
    ].indexOf(config.get('public_url')) !== -1;
}

const X_FRAME_ALLOWED = [
  '/communication_iframe',
  '/relay',
  '/embedded_tos',
  '/embedded_privacy'
];

// Keep track of which locales have TOS or PP localized
var tosLocales = [],
    privacyLocales = [];

var resourceViews = path.join(__dirname, '..', '..', 'resources', 'views');
fs.readdir(resourceViews, function(err, files) {
  if (err) return;

  files.forEach(function(localeDir) {
    ['tos.ejs', 'privacy.ejs'].forEach(function(template) {
      fs.stat(path.join(resourceViews, localeDir, template), function(err, stats) {
        if (!err && stats.isFile()) {
          if (template === 'tos.ejs') {
            tosLocales.push(localeDir);
          } else {
            privacyLocales.push(localeDir);
          }
        }
      });
    });
  });
});
exports.setup = function(app) {

  // Issue#1353 This is kind of dirty, but this is our last chance
  // to fixup headers for an ETag cache hit
  // x-frame-options - Allow these to be run within a frame
  app.use(function (req, res, next) {
    if (X_FRAME_ALLOWED.indexOf(req.path) !== -1) {
         res.removeHeader('x-frame-options');
    } else {
        var len = ('/' + req.lang).length;
        var path = req.path.substring(len);
        // if path starts with a language code
        if (req.path.substring(1, len) === req.lang &&
            X_FRAME_ALLOWED.indexOf(path) !== -1) {

            res.removeHeader('x-frame-options');
        }
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
    req.url = "/build/include.js";

    if (config.get('use_minified_resources') === true) {
      req.url = "/production/include.js";
    }

    next();
  });

  app.get('/include.orig.js', function(req, res, next) {
    req.url = "/build/include.js";

    // scripts/browserid.spec will put this file in place for builds installed
    // from `rpm`. But ephemerals do have use_minified_resources === true, so
    // we don't want to key off that. GH-3212
    if (isProductionEnvironment()) {
      req.url = "/production/include.orig.js";
    }

    next();
  });

  app.get('/provisioning_api.js', function(req, res, next) {
    if (config.get('use_minified_resources') === true) {
      req.url = "/production/provisioning_api.js";
    }

    next();
  });

  app.get('/provisioning_api.orig.js', function(req, res, next) {
    req.url = "/provisioning_api.js";
    next();
  });

  app.get('/authentication_api.js', function(req, res, next) {
    if (config.get('use_minified_resources') === true) {
      req.url = "/production/authentication_api.js";
    }

    next();
  });

  app.get('/authentication_api.orig.js', function(req, res, next) {
    req.url = "/authentication_api.js";
    next();
  });

  app.get('/production/bidbundle.js', function(req, res, next) {
    if (config.get('use_minified_resources') !== true) {
      req.url = '/common/js/lib/bidbundle.js';
    }
    next();
  });

  app.get('/build/code_version.js', function(req, res, next) {
    // Do not allow build/code_version.js to be requested
    // on stage or production.
    if (isProductionEnvironment()) {
      // Use an explicit 404 in case there are build artifacts around.
      httputils.notFound(res, "Cannot " + req.method + " " + req.url);
    }
    else {
      generate_version_js(function(err) {
        if (err) return httputils.serverError(res,
                     "Error generating code_version.js: " + String(err));

        // static middleware will take care of serving the created js file.
        next();
      });
    }
  });

  // this should probably be an internal redirect
  // as soon as relative paths are figured out.
  app.get('/sign_in', function(req, res) {
    renderCachableView(req, res, 'dialog.ejs', {
      title: _('A Better Way to Sign In'),
      layout: 'dialog_layout.ejs',
      useJavascript: true,
      measureDomLoading: config.get('measure_dom_loading'),
      production: config.get('use_minified_resources'),
      showLoading: true
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
      measureDomLoading: false,
      showLoading: false
    });
  });

  app.get("/unsupported_dialog_without_watch", function(req,res) {
    renderCachableView(req, res, 'unsupported_dialog_without_watch.ejs', {
      title: _('Unsupported Browser without Watch'),
      layout: 'dialog_layout.ejs',
      useJavascript: false,
      // without the javascript bundle, there is no point in measuring the
      // window opened time.
      measureDomLoading: false,
      showLoading: false
    });
  });

  app.get("/cookies_disabled", function(req,res) {
    renderCachableView(req, res, 'cookies_disabled.ejs', {
      title: _('Cookies Are Disabled'),
      layout: 'dialog_layout.ejs',
      useJavascript: false,
      // without the javascript bundle, there is no point in measuring the
      // window opened time.
      measureDomLoading: false,
      showLoading: false
    });
  });

  // Used for a relay page for communication.
  app.get("/relay", function(req, res) {
    renderCachableView(req, res, 'relay.ejs', {
      layout: false,
      production: config.get('use_minified_resources')
    });
  });

  app.get('/', function(req,res) {
    renderCachableView(req, res, 'index.ejs', {title: _('A Better Way to Sign In'), fullpage: true});
  });

  app.get("/about", function(req, res) {
    renderCachableView(req, res, 'about.ejs', {title: _('About'), fullpage: false});
  });

  function pickLocale(supported, lang) {
    var templateLocale = 'en',
        locale = i18n.localeFrom(lang);

    if (supported.indexOf(locale) !== -1) {
      templateLocale = locale;
    }
    return templateLocale;
  }

  app.get("/:lang/tos", function(req, res) {
    renderCachableView(req, res,
      pickLocale(tosLocales, req.params.lang) + '/tos.ejs', {
        title: _('Terms of Service'),
        fullpage: false
    });
  });

  app.get("/:lang/embedded_tos", function(req, res) {
    renderCachableView(req, res,
      pickLocale(tosLocales, req.params.lang) + '/tos.ejs', {
        title: _('Terms of Service'),
        embedded: true
    });
  });

  app.get("/:lang/privacy", function(req, res) {
    renderCachableView(req, res,
      pickLocale(tosLocales, req.params.lang) + '/privacy.ejs', {
        title: _('Privacy Policy'),
        fullpage: false
    });
  });

  app.get("/:lang/embedded_privacy", function(req, res) {
    renderCachableView(req, res,
      pickLocale(tosLocales, req.params.lang) + '/privacy.ejs', {
        title: _('Privacy Policy'),
        embedded: true
    });
  });

  app.get("/verify_email_address", function(req, res) {
    res.local('util', util);
    renderCachableView(req, res, 'confirm.ejs', {
      title: _('Complete Registration'),
      fullpage: true,
      enable_development_menu: config.get('enable_development_menu'),
      start_blank: true
    });
  });

  // This page can be removed a couple weeks after this code ships into production,
  // we're leaving it here to not break outstanding emails
  app.get("/add_email_address", function(req,res) {
    renderCachableView(req, res, 'confirm.ejs', {
      title: _('Verify Email Address'),
      fullpage: false,
      start_blank: true
    });
  });

  app.get("/reset_password", function(req,res) {
    renderCachableView(req, res, 'reset_password.ejs', {title: _('Reset Password')});
  });

  app.get("/confirm", function(req,res) {
    renderCachableView(req, res, 'confirm.ejs', {
      title: _('Confirm Email'),
      start_blank: true
    });
  });

  app.get("/complete_transition", function(req,res) {
    renderCachableView(req, res, 'confirm.ejs', {
      title: _('Confirm Email'),
      start_blank: true
    });
  });

  var humans = fs.readFileSync(path.join(__dirname, "..", "..", "CONTRIBUTORS")).toString();
  app.get("/humans.txt", function(req, res) {
    cacheAllTheThings(res);
    res.setHeader('Content-Type', 'text/plain; charset=utf8');
    res.send(humans);
  });



  // serve up testing templates.  but NOT in staging or production.  see GH-1044
  if (isProductionEnvironment()) {
    // this is stage or production, explicitly disable all resources under /test
    app.get(/^\/test/, function(req, res) {
      httputils.notFound(res, "Cannot " + req.method + " " + req.url);
    });
  } else {
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
  }

  // REDIRECTS (301 - Moved Permanently, 302 - Found)
  const REDIRECTS = {
    "/developers" : { code : 302, url : "https://developer.mozilla.org/docs/persona" },
    "/signin"     : { code : 301, url : "/" },
    "/forgot"     : { code : 301, url : "/" },
    "/signup"     : { code : 301, url : "/" },
  };

  function redirect(from, to) {
    app.get(from, function(req, res) {
      // express v2.5 is (url, [code]). express v3 is ([code], url)
      res.redirect(to.url, to.code);
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
    // set a very conservative cache-control header on the .well-known,
    // verifiers should ping us frequently.  As we become more comfortable
    // with our ability to update with zero user impact we can increase
    // this.  issue #3249
    res.setHeader('Cache-Control', 'public, max-age=10');

    var qs = querystring.parse(
               url.parse(req.originalUrl).query);
    var domain = qs.domain || '';

    if (!config.has('proxy_idps')) {
      return res.json({ 'public-key': publicKey.toSimpleObject() });
    }

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
