/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
logger = require('../logging.js').logger,
wsapi = require('../wsapi.js');

exports.method = 'post';
exports.writes_db = true;
// XXX: see issue #290 - we want to require authentication here and update frontend code
exports.authed = false;
// NOTE: this API also takes a 'pass' parameter which is required
// when a user has a null password (only primaries on their acct)
exports.args = ['token'];
exports.i18n = false;

exports.process = function(req, res) {
  db.emailForVerificationSecret(req.body.token, function(err, r) {
    if (err === 'database unavailable') {
      return wsapi.databaseDown(res, err);
    }

    db.gotVerificationSecret(req.body.token, function(e, email, uid) {
      if (e) {
        logger.warn("couldn't complete email verification: " + e);
        wsapi.databaseDown(res, e);
      } else {
        wsapi.authenticateSession(req.session, uid, 'password');
        res.json({ success: true });
      }
    });
  });
};
