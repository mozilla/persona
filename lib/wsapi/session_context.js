/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
logger = require('../logging/logging.js').logger,
crypto = require('crypto'),
wsapi = require('../wsapi.js'),
secrets = require('../secrets.js'),
version = require('../version.js'),
config = require('../configuration.js'),
Cookies = require('cookies');

// return the CSRF token, authentication status, and current server time (for assertion signing)
// 2011-12-22: adding a random seed for keygen
// IMPORTANT: this is safe because it's only readable by same-origin code

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.i18n = false;

// determine the domain key creation date - issue #599
const domainKeyCreationDate = secrets.publicKeyCreationDate();
logger.debug("domain key was created at " + domainKeyCreationDate + " (certs issued prior to this are bogus)");

function dataSampleRate(req) {
  var ua = req.headers['user-agent'];
  var rate = config.get('kpi.backend_sample_rate');
  var per_agent_map = config.get('kpi.backend_sample_rate_per_agent');

  for (var agent in per_agent_map) {
    if (ua.match(agent)) {
      rate = per_agent_map[agent];
      break;
    }
  }

  return rate;
}

exports.process = function(req, res) {
  if (typeof req.session === 'undefined') {
    req.session = {};
  }

  if (typeof req.session.csrf === 'undefined') {
    // more random CSRF
    // FIXME: async?
    req.session.csrf = crypto.randomBytes(16).toString('base64');
    logger.debug("NEW csrf token created: " + req.session.csrf);
  }

  // session_context always checks for a javascript readable cookie,
  // this allows our javascript code in the dialog and communication iframe
  // to determine whether cookies are (partially) disabled.  See #2999 for
  // more context.
  var cookies = new Cookies(req, res);
  var hasCookie = !!cookies.get('can_set_cookies');

  var auth_level;
  var has_password = false;
  var authenticated = false;

  function sendResponse(sha) {
    var respObj = {
      csrf_token: req.session.csrf,
      server_time: (new Date()).getTime(),
      authenticated: authenticated,
      auth_level: auth_level,
      has_password: has_password,
      domain_key_creation_time: domainKeyCreationDate.getTime(),
      random_seed: crypto.randomBytes(32).toString('base64'),
      data_sample_rate: dataSampleRate(req),
      // If the user is authenticated, we know we can at least get the
      // authentication cookie, even if we can't get the cookie that was set in
      // the browser.
      cookies: hasCookie || !!authenticated
    };
    if (config.get('enable_code_version')) {
      respObj.code_version = sha;
    }
    if (req.session && req.session.userid) {
      respObj.userid = req.session.userid;
    }

    res.json(respObj);
  }

  // if they're authenticated for an email address that we don't know about,
  // then we should purge the stored cookie
  if (!wsapi.isAuthed(req, 'assertion')) {
    logger.debug("user is not authenticated");
    version(sendResponse);
  } else {
    db.userKnown(req.session.userid, function (err, known, hasPassword) {
      if (err) {
        return wsapi.databaseDown(res, err);
      } else if (!known) {
        logger.debug("user is authenticated with an account that doesn't exist in the database");
        wsapi.clearAuthenticatedUser(req.session);
      } else {
        logger.debug("user is authenticated");
        auth_level = req.session.auth_level;
        has_password = hasPassword;
        authenticated = true;
      }
      version(sendResponse);
    });
  }
};
