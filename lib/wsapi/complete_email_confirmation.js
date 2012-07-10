/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
logger = require('../logging.js').logger,
wsapi = require('../wsapi.js'),
bcrypt = require('../bcrypt.js'),
httputils = require('../httputils.js');

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
// NOTE: this API also takes a 'pass' parameter which is required
// when a user has a null password (only primaries on their acct)
exports.args = ['token'];
exports.i18n = false;

exports.process = function(req, res) {
  // in order to complete an email addition, one of the following must be true:
  //
  // 1. you must already be authenticated as the user who initiated the verification
  // 2. you must provide the password of the initiator.

  db.authForVerificationSecret(req.body.token, function(err, initiator_hash, initiator_uid) {
    if (err) {
      logger.info("unknown verification secret: " + err);
      return wsapi.databaseDown(res, err);
    }

    if (req.session.userid === initiator_uid) {
      postAuthentication();
    } else if (typeof req.body.pass === 'string') {
      bcrypt.compare(req.body.pass, initiator_hash, function (err, success) {
        if (err) {
          logger.warn("max load hit, failing on auth request with 503: " + err);
          return httputils.serviceUnavailable(res, "server is too busy");
        } else if (!success) {
          return httputils.authRequired(res, "password mismatch");
        } else {
          postAuthentication();
        }
      });
    } else {
      return httputils.authRequired(res, "password required");
    }

    function postAuthentication() {
      db.completeAddEmail(req.body.token, function(e, email, uid) {
        if (e) {
          logger.warn("couldn't complete email verification: " + e);
          wsapi.databaseDown(res, e);
        } else {
          wsapi.authenticateSession(req.session, uid, 'password');
          res.json({ success: true });
        }
      });
    };
  });
};
