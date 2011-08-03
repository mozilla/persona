const
fs = require('fs'),
path = require('path');

// create the var directory if it doesn't exist
var VAR_DIR = path.join(__dirname, "var");
try { fs.mkdirSync(VAR_DIR, 0755); } catch(e) { };

const
url = require('url'),
crypto = require('crypto'),
wsapi = require('./lib/wsapi.js'),
httputils = require('./lib/httputils.js'),
webfinger = require('./lib/webfinger.js'),
sessions = require('cookie-sessions'),
express = require('express'),
secrets = require('./lib/secrets.js'),
db = require('./lib/db.js'),
configuration = require('../libs/configuration.js'),
substitution = require('../libs/substitute.js');

// open the databse
db.open();

// looks unused, see run.js
// const STATIC_DIR = path.join(path.dirname(__dirname), "static");
const COOKIE_SECRET = secrets.hydrateSecret('cookie_secret', VAR_DIR);
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
  app.get('/sign_in', function(req, res, next ){
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
    console.log("code updated.  shutting down.");
    process.exit();
  });
};

exports.varDir = VAR_DIR;

exports.setup = function(server) {
  server.use(express.cookieParser());

  var cookieSessionMiddleware = sessions({
    secret: COOKIE_SECRET,
    session_key: COOKIE_KEY,
    path: '/'
  });

  server.use(function(req, resp, next) {
    try {
      cookieSessionMiddleware(req, resp, next);
    } catch(e) {
      console.log("invalid cookie found: ignoring");
      delete req.cookies[COOKIE_KEY];
      cookieSessionMiddleware(req, resp, next);
    }
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

  // prevent framing
  server.use(function(req, resp, next) {
    resp.setHeader('x-frame-options', 'DENY');
    next();
  });

  // check CSRF token
  server.use(function(req, resp, next) {
    // only on POSTs
    if (req.method == "POST") {
      if (req.body.csrf != req.session.csrf) {
        // error, problem with CSRF
        throw new Error("CSRF violation - " + req.body.csrf + '/' + req.session.csrf);
      }
    }

    next();
  });

  // add middleware to re-write urls if needed
  configuration.performSubstitution(server);

  // add the actual URL handlers other than static
  router(server);
}
