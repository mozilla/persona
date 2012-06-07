/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// an abstraction that implements all of the cookie handling, CSRF protection,
// etc of the wsapi.  This module also routes request to the approriate handlers
// underneath wsapi/
//
// each handler under wsapi/ supports the following exports:
//   exports.process - function(req, res) - process a request
//   exports.writes_db - must be true if the processing causes a database write
//   exports.method - either 'get' or 'post'
//   exports.authed - whether the wsapi requires authentication
//   exports.args - an array of arguments that should be verified
//   exports.i18n - boolean, does this operation display user facing strings


const
sessions = require('client-sessions'),
express = require('express'),
secrets = require('./secrets'),
config = require('./configuration'),
logger = require('./logging.js').logger,
httputils = require('./httputils.js'),
forward = require('./http_forward.js').forward,
url = require('url'),
fs = require('fs'),
path = require('path'),
validate = require('./validate'),
statsd = require('./statsd'),
bcrypt = require('./bcrypt'),
i18n = require('./i18n');

var abide = i18n.abide({
  supported_languages: config.get('supported_languages'),
  default_lang: config.get('default_lang'),
  locale_directory: config.get('locale_directory'),
  disable_locale_check: config.get('disable_locale_check')
});

const COOKIE_SECRET = secrets.hydrateSecret('browserid_cookie', config.get('var_path'));
var COOKIE_KEY = 'browserid_state';

// to support testing of browserid, we'll add a hash fragment to the cookie name for
// sites other than browserid.org.  This is to address a bug in IE, see issue #296
if (config.get('public_url').indexOf('https://browserid.org') !== 0) {
  const crypto = require('crypto');
  var hash = crypto.createHash('md5');
  hash.update(config.get('public_url'));
  COOKIE_KEY += "_" + hash.digest('hex').slice(0, 6);
}

logger.info('session cookie name is: ' + COOKIE_KEY);

function clearAuthenticatedUser(session) {
  session.reset(['csrf']);
}

function isAuthed(req, requiredLevel) {
  if (req.session && req.session.userid && req.session.auth_level) {
    // 'password' authentication allows access to all apis.
    // 'assertion' authentication, grants access to only those apis
    // that don't require 'password'
    if (requiredLevel === 'assertion' || req.session.auth_level === 'password') {
      return true;
    }
  }
  return false;
}

function bcryptPassword(password, cb) {
  var startTime = new Date();
  bcrypt.encrypt(config.get('bcrypt_work_factor'), password, function() {
    var reqTime = new Date - startTime;
    statsd.timing('bcrypt.encrypt_time', reqTime);
    cb.apply(null, arguments);
  });
};

function authenticateSession(session, uid, level, duration_ms) {
  if (['assertion', 'password'].indexOf(level) === -1)
    throw "invalid authentication level: " + level;

  // if the user is *already* authenticated as this uid with an equal or better
  // level of auth, let's not lower them.  Issue #1049
  if (session.userid === uid && session.auth_level === 'password' &&
      session.auth_level !== level) {
    logger.info("not resetting cookies to 'assertion' authenticate a user who is already password authenticated");
  } else {
    if (duration_ms) {
      session.setDuration(duration_ms);
    }
    session.userid = uid;
    session.auth_level = level;
  }
}

function checkPassword(pass) {
  if (!pass || pass.length < 8 || pass.length > 80) {
    return "valid passwords are between 8 and 80 chars";
  }
}

function langContext(req) {
  return {
    lang: req.lang,
    locale: req.locale,
    gettext: req.gettext,
    ngettext: req.ngettext,
    format: req.format
  };
}

function databaseDown(res, err) {
  logger.warn('database is down, cannot process request: ' + err);
  httputils.serviceUnavailable(res, "database unavailable");
}

// common functions exported, for use by different api calls
exports.clearAuthenticatedUser = clearAuthenticatedUser;
exports.isAuthed = isAuthed;
exports.bcryptPassword = bcryptPassword;
exports.authenticateSession = authenticateSession;
exports.checkPassword = checkPassword;
exports.forwardWritesTo = undefined;
exports.langContext = langContext;
exports.databaseDown = databaseDown;

exports.setup = function(options, app) {
  const WSAPI_PREFIX = '/wsapi/';

  // all operations that are being forwarded
  var forwardedOperations = [];

  // If externally we're serving content over SSL we can enable things
  // like strict transport security and change the way cookies are set
  const overSSL = (config.get('scheme') == 'https');

  var cookieParser = express.cookieParser();
  var bodyParser = express.bodyParser();

  // stash our forward-to url so different wsapi handlers can use it
  exports.forwardWritesTo = options.forward_writes;

  var cookieSessionMiddleware = sessions({
    secret: COOKIE_SECRET,
    cookieName: COOKIE_KEY,
    duration: config.get('authentication_duration_ms'),
    cookie: {
      path: '/wsapi',
      httpOnly: true,
      maxAge: config.get('authentication_duration_ms'),
      secure: overSSL
    }
  });

  app.use(function(req, resp, next) {
    var purl = url.parse(req.url);

    // cookie sessions are only applied to calls to /wsapi
    // as all other resources can be aggressively cached
    // by layers higher up based on cache control headers.
    // the fallout is that all code that interacts with sessions
    // should be under /wsapi
    if (purl.pathname.substr(0, WSAPI_PREFIX.length) === WSAPI_PREFIX)
    {
      // explicitly disallow caching on all /wsapi calls (issue #294)
      resp.setHeader('Cache-Control', 'no-cache, max-age=0');

      // we set this parameter so the connect-cookie-session
      // sends the cookie even though the local connection is HTTP
      // (the load balancer does SSL)
      if (overSSL)
        req.connection.proxySecure = true;

      const operation = purl.pathname.substr(WSAPI_PREFIX.length);

      // count the number of WSAPI operation
      statsd.increment("wsapi." + operation);

      // check to see if the api is known here, before spending more time with
      // the request.
      if (!wsapis.hasOwnProperty(operation) ||
          wsapis[operation].method.toLowerCase() !== req.method.toLowerCase())
      {
        // if the fake verification api is enabled (for load testing),
        // then let this request fall through
        if (operation !== 'fake_verification' || !process.env['BROWSERID_FAKE_VERIFICATION'])
          return httputils.badRequest(resp, "no such api");
      }

      // if this request is to be forwarded, we will not perform request validation,
      // cookie parsing, nor body parsing - leaving that up to the process we're forwarding
      // to.
      if (-1 !== forwardedOperations.indexOf(operation)) {
        // queue up the body here on and forward a single unchunked request onto the
        // writer
        return bodyParser(req, resp, function() {
          next();
        });
      } else if (options.router_mode) {
        // skip wsapi request, let browserid middleware handle forwards
        return next();
      } else {
        // this is not a forwarded operation, perform full parsing and validation
        return cookieParser(req, resp, function() {
          bodyParser(req, resp, function() {
            cookieSessionMiddleware(req, resp, function() {
              // only on POSTs
              if (req.method === "POST") {

                if (req.session === undefined || typeof req.session.csrf !== 'string') { // there must be a session
                  logger.warn("POST calls to /wsapi require a cookie to be sent, this user may have cookies disabled");
                  return httputils.forbidden(resp, "no cookie");
                }

                // and the token must match what is sent in the post body
                else if (!req.body || !req.session || !req.session.csrf || req.body.csrf != req.session.csrf) {
                  // if any of these things are false, then we'll block the request
                  var b = req.body ? req.body.csrf : "<none>";
                  var s = req.session ? req.session.csrf : "<none>";
                  logger.warn("CSRF validation failure, token mismatch. got:" + b + " want:" + s);
                  return httputils.badRequest(resp, "CSRF violation");
                }
              }
              return next();
            });
          });
        });
      }
    } else {
      return next();
    }
  });

  // load all of the APIs supported by this process
  var wsapis = { };

  function describeOperation(name, op) {
    var str = "  " + name + " (";
    str += op.method.toUpperCase() + " - ";
    str += (op.authed ? "" : "not ") + "authed";
    if (op.args) {
      str += " - " + op.args.join(", ");
    }
    str += ")";
    logger.debug(str);
  }

  fs.readdirSync(path.join(__dirname, 'wsapi')).forEach(function (f) {
    // skip files that don't have a .js suffix or start with a dot
    if (f.length <= 3 || f.substr(-3) !== '.js' || f.substr(0,1) === '.') return;
    var operation = f.substr(0, f.length - 3);

    try {
      var api = require(path.join(__dirname, 'wsapi', f));

      // don't register read apis if we are configured as a writer,
      // with the exception of ping which tests database connection health.
      if (options.only_write_apis && !api.writes_db &&
          operation != 'ping') return;

      wsapis[operation] = api;

      // forward writes if options.forward_writes is defined
      if (options.forward_writes && wsapis[operation].writes_db &&
          !wsapis[operation].disallow_forward)
      {
        forwardedOperations.push(operation);
        var forward_url = options.forward_writes + "/wsapi/" + operation;
        wsapis[operation].process = function(req, res) {
          forward(forward_url, req, res, function(err) {
            if (err) {
              logger.error("error forwarding '"+ operation +
                           "' request to '" + options.forward_writes + ":" + err);
              httputils.serverError(res, "internal request forwarding error");
            }
          });
        };

        // XXX: disable validation on forwarded requests
        // (we cannot perform this validation because we don't parse cookies
        // nor post bodies on forwarded requests)
        //
        // at some point we'll want to improve our cookie parser and
        // fully validate forwarded requests both at the intermediate
        // hop (webhead) AND final destination (secure webhead)

        delete api.args; // deleting args will cause arg validation to be skipped

        api.authed = false; // authed=false will prevent us from checking auth status
      }

      // set up the argument validator
      if (api.args) {
        if (!Array.isArray(api.args)) throw "exports.args must be an array of strings";
        wsapis[operation].validate = validate(api.args);
      } else {
        wsapis[operation].validate = function(req,res,next) { next(); };
      }

    } catch(e) {
      var msg = "error registering " + operation + " api: " + e;
      logger.error(msg);
      throw msg;
    }
  });

  // debug output - all supported apis
  logger.debug("WSAPIs:");
  Object.keys(wsapis).forEach(function(api) {
    if (options.forward_writes && wsapis[api].writes_db) return;
    describeOperation(api, wsapis[api]);
  });

  if (options.forward_writes) {
    logger.debug("forwarded WSAPIs (to " + options.forward_writes + "):");
    Object.keys(wsapis).forEach(function(api) {
      if (wsapis[api].writes_db) {
        describeOperation(api, wsapis[api]);
      }
    });
  }

  app.use(function(req, resp, next) {
    var purl = url.parse(req.url);

    if (purl.pathname.substr(0, WSAPI_PREFIX.length) === WSAPI_PREFIX) {
      const operation = purl.pathname.substr(WSAPI_PREFIX.length);

      if (options.router_mode && -1 === forwardedOperations.indexOf(operation)) {
        // skip wsapi request, let browserid middleware handle forwards
        return next();
      }

      // the fake_verification wsapi is implemented elsewhere.
      if (operation == 'fake_verification') return next();

      // at this point, we *know* 'operation' is valid API, give checks performed
      // above

      // does the request require authentication?
      if (wsapis[operation].authed && !isAuthed(req, wsapis[operation].authed)) {
        return httputils.badRequest(resp, "requires authentication");
      }

      // validate the arguments of the request
      wsapis[operation].validate(req, resp, function() {
        if (wsapis[operation].i18n) {
          abide(req, resp, function () {
            wsapis[operation].process(req, resp);
          });
        } else {
          wsapis[operation].process(req, resp);
        }
      });
    } else {
      next();
    }
  });
};
