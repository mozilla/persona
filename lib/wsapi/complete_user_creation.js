/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger;

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
exports.args = ['token'];
exports.i18n = false;

exports.process = function(req, res) {
  // at the time the email verification is performed, we'll clear the pendingCreation
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
};
