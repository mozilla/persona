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
  // simple redirects (internal for now)
  app.get('/sign_in', internal_redirector('/dialog/index.html'));
  app.get('/register_iframe', internal_redirector('/dialog/register_iframe.html'));

  app.all('/wsapi/:method', function(req, resp, next) {
      try {
        wsapi[req.params.method](req, resp);
      } catch (e) {
        var errMsg = "oops, error executing wsapi method: " + method + " (" + e.toString() +")";
        console.log(errMsg);
        httputils.fourOhFour(response, errMsg);
      }
    });

  app.get('/users/acct\::identity.xml', function(req, resp, next) {
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

  // add the methods
  router(server);

  // a tweak to get the content type of host-meta correct
  server.use(function(req, resp, next) {
    if (req.url === '/.well-known/host-meta') {
      resp.setHeader('content-type', 'text/xml');
    }
    next();
  });
}
