const          fs = require('fs'),
             path = require('path');

// create the var directory if it doesn't exist
var VAR_DIR = path.join(__dirname, "var");
try { fs.mkdirSync(VAR_DIR, 0755); } catch(e) { };

const         url = require('url'),
            wsapi = require('./lib/wsapi.js'),
        httputils = require('./lib/httputils.js'),
        webfinger = require('./lib/webfinger.js'),
         sessions = require('cookie-sessions'),
          express = require('express'),
          secrets = require('./lib/secrets.js'),
               db = require('./lib/db.js');

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

  // this should probably be an internal redirect
  // as soon as relative paths are figured out.
  app.get('/sign_in', function(req, resp, next ){
      resp.redirect('/dialog/dialog.html');
    });

  // simple redirects (internal for now)
  app.get('/register_iframe', internal_redirector('/dialog/register_iframe.html'));

  app.get('/', function(req,res) {
      res.render('index.ejs', {title: 'A Better Way to Log In', fullpage: true});
    });

  app.get('/prove', function(req,res) {
      res.render('prove.ejs', {title: 'Verify Email Address', fullpage: false});
    });

  app.get('/users', function(req,res) {
      res.render('users.ejs', {title: 'for Users', fullpage: false});
    });

  app.get('/developers', function(req,res) {
      res.render('developers.ejs', {title: 'for Developers', fullpage: false});
    });

  app.get('/primaries', function(req,res) {
      res.render('primaries.ejs', {title: 'for Primary Authorities', fullpage: false});
    });

  app.get('/manage', function(req,res) {
      res.render('manage.ejs', {title: 'My Account', fullpage: false});
    });

  app.get('/tos', function(req, res) {
      res.render('tos.ejs', {title: 'Terms of Service', fullpage: false});
    });

  app.get('/privacy', function(req, res) {
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

  // a tweak to get the content type of host-meta correct
  server.use(function(req, resp, next) {
    if (req.url === '/.well-known/host-meta') {
      resp.setHeader('content-type', 'text/xml');
    }
    next();
  });

  // add the actual URL handlers other than static
  router(server);
}
