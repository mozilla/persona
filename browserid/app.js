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

const
fs = require('fs'),
path = require('path'),
url = require('url'),
crypto = require('crypto'),
wsapi = require('./lib/wsapi.js'),
httputils = require('./lib/httputils.js'),
webfinger = require('./lib/webfinger.js'),
sessions = require('connect-cookie-session'),
express = require('express'),
secrets = require('./lib/secrets.js'),
db = require('./lib/db.js'),
configuration = require('../libs/configuration.js'),
substitution = require('../libs/substitute.js');
metrics = require("../libs/metrics.js"),
logger = require("../libs/logging.js").logger;

logger.info("browserid server starting up");

// open the databse
db.open(configuration.get('database'));

const COOKIE_SECRET = secrets.hydrateSecret('browserid_cookie', configuration.get('var_path'));
const COOKIE_KEY = 'browserid_state';

function internal_redirector(new_url) {
  return function(req, resp, next) {
    req.url = new_url;
    return next();
  };
}

function router(app) {
  app.set("views", __dirname + '/views');

  app.set('view options', {
    production: configuration.get('use_minified_resources')
  });

  // this should probably be an internal redirect
  // as soon as relative paths are figured out.
  app.get('/sign_in', function(req, res, next ) {
    metrics.userEntry(req);
    res.render('dialog.ejs', {
      title: 'A Better Way to Sign In',
      layout: false,
      production: configuration.get('use_minified_resources')
    });
  });

  // simple redirects (internal for now)
  app.get('/register_iframe', internal_redirector('/dialog/register_iframe.html'));

  // return the CSRF token
  // IMPORTANT: this should be safe because it's only readable by same-origin code
  // but we must be careful that this is never a JSON structure that could be hijacked
  // by a third party
  app.get('/csrf', function(req, res) {
    res.write(req.session.csrf);
    res.end();
  });

  app.get('/', function(req,res) {
    res.render('index.ejs', {title: 'A Better Way to Sign In', fullpage: true});
  });

  app.get(/^\/prove(\.html)?$/, function(req,res) {
    res.render('prove.ejs', {title: 'Verify Email Address', fullpage: false});
  });

  app.get(/^\/users(\.html)?$/, function(req,res) {
    res.render('users.ejs', {title: 'for Users', fullpage: false});
  });

  app.get(/^\/developers(\.html)?$/, function(req,res) {
    res.render('developers.ejs', {title: 'for Developers', fullpage: false});
  });

  app.get(/^\/primaries(\.html)?$/, function(req,res) {
    res.render('primaries.ejs', {title: 'for Primary Authorities', fullpage: false});
  });

  app.get(/^\/manage(\.html)?$/, function(req,res) {
    res.render('manage.ejs', {title: 'My Account', fullpage: false, csrf: req.session.csrf});
  });

  app.get(/^\/tos(\.html)?$/, function(req, res) {
    res.render('tos.ejs', {title: 'Terms of Service', fullpage: false});
  });

  app.get(/^\/privacy(\.html)?$/, function(req, res) {
    res.render('privacy.ejs', {title: 'Privacy Policy', fullpage: false});
  });

  // register all the WSAPI handlers
  wsapi.setup(app);

  app.get('/users/:identity.xml', function(req, resp, next) {
    webfinger.renderUserPage(req.params.identity, function (resultDocument) {
      if (resultDocument === undefined) {
        httputils.fourOhFour(resp, "I don't know anything about: " + req.params.identity + "\n");
      } else {
        httputils.xmlResponse(resp, resultDocument);
      }
    });
  });

  app.get('/code_update', function(req, resp, next) {
    logger.warn("code updated.  shutting down.");
    process.exit();
  });
};

exports.setup = function(server) {
  // request to logger, dev formatted which omits personal data in the requests
  server.use(express.logger({
    format: 'dev',
    stream: {
      write: function(x) {
        logger.info(typeof x === 'string' ? x.trim() : x);
      }
    }
  }));

  // over SSL?
  var overSSL = (configuration.get('scheme') == 'https');
  
  server.use(express.cookieParser());

  var cookieSessionMiddleware = sessions({
    secret: COOKIE_SECRET,
    key: COOKIE_KEY,
    cookie: {
      path: '/',
      httpOnly: true,
      // IMPORTANT: we allow users to go 1 weeks on the same device
      // without entering their password again
      maxAge: (7 * 24 * 60 * 60 * 1000), 
      secure: overSSL
    }
  });

  // cookie sessions
  server.use(function(req, resp, next) {
    // we set this parameter so the connect-cookie-session
    // sends the cookie even though the local connection is HTTP
    // (the load balancer does SSL)
    if (overSSL)
      req.connection.proxySecure = true;

    return cookieSessionMiddleware(req, resp, next);
  });

  server.use(express.bodyParser());

  // we make sure that everyone has a session, otherwise we can't do CSRF properly
  server.use(function(req, resp, next) {
    if (typeof req.session == 'undefined')
      req.session = {};

    if (typeof req.session.csrf == 'undefined') {
      // FIXME: using express-csrf's approach for generating randomness
      // not awesome, but probably sufficient for now.
      req.session.csrf = crypto.createHash('md5').update('' + new Date().getTime()).digest('hex');
      logger.debug("NEW csrf token created: " + req.session.csrf);
    }

    next();
  });

  // a tweak to get the content type of host-meta correct
  server.use(function(req, resp, next) {
    if (req.url === '/.well-known/host-meta') {
      resp.setHeader('content-type', 'text/xml');
    }
    next();
  });

  // Strict Transport Security
  server.use(function(req, resp, next) {
      if (overSSL) {
        // expires in 30 days, include subdomains like www
        resp.setHeader("Strict-Transport-Security", "max-age=2592000; includeSubdomains");
      }
      next();
    });

  // prevent framing
  server.use(function(req, resp, next) {
    resp.setHeader('x-frame-options', 'DENY');
    next();
  });

  // check CSRF token
  server.use(function(req, resp, next) {
    // only on POSTs
    if (req.method == "POST" && req.body.csrf != req.session.csrf) {
      // error, problem with CSRF
      logger.warn("CSRF token mismatch.  got:" + req.body.csrf + " wanted:" + req.session.csrf);
      httputils.badRequest(resp, "CSRF violation");
    } else {
      next();
    }
  });

  // add middleware to re-write urls if needed
  configuration.performSubstitution(server);

  // add the actual URL handlers other than static
  router(server);
}
