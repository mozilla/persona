/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
logger = require('../logging.js').logger,
crypto = require('crypto'),
wsapi = require('../wsapi.js'),
secrets = require('../secrets.js'),
version = require('../version.js'),
config = require('../configuration.js');

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

exports.process = function(req, res) {
  if (typeof req.session == 'undefined') {
    req.session = {};
  }

  if (typeof req.session.csrf == 'undefined') {
    // more random CSRF
    // FIXME: async?
    req.session.csrf = crypto.randomBytes(16).toString('base64');
    logger.debug("NEW csrf token created: " + req.session.csrf);
  }

  var auth_level = undefined;
  var authenticated = false;

  function sendResponse() {
    var respObj = {
      csrf_token: req.session.csrf,
      server_time: (new Date()).getTime(),
      authenticated: authenticated,
      auth_level: auth_level,
      domain_key_creation_time: domainKeyCreationDate.getTime(),
      random_seed: crypto.randomBytes(32).toString('base64'),
      data_sample_rate: config.get('kpi_backend_sample_rate')
    };
    if (config.get('enable_code_version')) {
      respObj.code_version = version();
    }
    if (req.session && req.session.userid) {
      respObj.userid = req.session.userid;
    }

    res.json(respObj);
  };

  // if they're authenticated for an email address that we don't know about,
  // then we should purge the stored cookie
  if (!wsapi.isAuthed(req, 'assertion')) {
    logger.debug("user is not authenticated");
    sendResponse();
  } else {
    db.userKnown(req.session.userid, function (err, known) {
      if (err) {
        return wsapi.databaseDown(res, err);
      } else if (!known) {
        logger.debug("user is authenticated with an account that doesn't exist in the database");
        wsapi.clearAuthenticatedUser(req.session);
      } else {
        logger.debug("user is authenticated");
        auth_level = req.session.auth_level;
        authenticated = true;
      }
      sendResponse();
    });
  }
};
