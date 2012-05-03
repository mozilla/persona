/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
bcrypt = require('../bcrypt');

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
exports.args = ['token'];
exports.i18n = false;

exports.process = function(req, res) {
  // in order to complete a user creation, one of the following must be true:
  //
  // 1. you are using the same browser to complete the email verification as you
  //    used to start it
  // 2. you have provided the password chosen by the initiator of the verification
  //    request
  //
  // These protections guard against the case where an attacker can send out a bunch
  // of verification emails, wait until a distracted internet user clicks on one,
  // and then control a browserid account that they can use to prove they own
  // the email address of the attacked.

  // is this the same browser?
  if (typeof req.session.pendingCreation === 'string' &&
      req.body.token === req.session.pendingCreation) {
    postAuthentication();
  }
  // is a password provided?
  else if (typeof req.body.pass === 'string') {
    return db.authForVerificationSecret(req.body.token, function(err, hash) {
      if (err) {
        logger.warn("couldn't get password for verification secret: " + err);
        return wsapi.databaseDown(res, err);
      }
      bcrypt.compare(req.body.pass, hash, function (err, success) {
        if (err) {
          logger.warn("max load hit, failing on auth request with 503: " + err);
          return httputils.serviceUnavailable(res, "server is too busy");
        } else if (!success) {
          return httputils.authRequired(res, "password mismatch");
        } else {
          postAuthentication();
        }
      });
    });
  } else {
    return httputils.authRequired(res, 'Provide your password');
  }

  function postAuthentication() {
    // the time the email verification is performed, we'll clear the pendingCreation
    // data on the session.
    delete req.session.pendingCreation;

    db.haveVerificationSecret(req.body.token, function(err, known) {
      if (err) return wsapi.databaseDown(res, err);

      if (!known) return res.json({ success: false} );

      db.gotVerificationSecret(req.body.token, function(err, email, uid) {
        if (err) {
          logger.warn("couldn't complete email verification: " + err);
          wsapi.databaseDown(res, err);
        } else {
          // FIXME: not sure if we want to do this (ba)
          // at this point the user has set a password associated with an email address
          // that they've verified.  We create an authenticated session.
          wsapi.authenticateSession(req.session, uid, 'password',
                                    config.get('ephemeral_session_duration_ms'));
          res.json({ success: true });
        }
      });
    });
  }
};
