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
  // a password *must* be supplied to this call iff the user's password
  // is currently NULL - this would occur in the case where this is the
  // first secondary address to be added to an account
  db.emailForVerificationSecret(req.body.token, function(err, r) {
    if (err === 'database unavailable') {
      return wsapi.databaseDown(res, err);
    }

    if (!err && r.needs_password && !req.body.pass) {
      err = "user must choose a password";
    }
    if (!err && !r.needs_password && req.body.pass) {
      err = "a password may not be set at this time";
    }
    if (!err && r.needs_password) err = wsapi.checkPassword(req.body.pass);

    if (err) {
      logger.info("addition of email fails: " + err);
      return res.json({
        success: false,
        reason: err
      });
    }

    // got verification secret's second paramter is a password.  That password
    // will only be used on new account creation.  Because we know this is not
    // a new account, we don't provide it.
    db.gotVerificationSecret(req.body.token, "", function(e, email, uid) {
      if (e) {
        logger.warn("couldn't complete email verification: " + e);
        wsapi.databaseDown(res, e);
      } else {
        // now do we need to set the password?
        if (r.needs_password && req.body.pass) {
          // requiring the client to wait until the bcrypt process is complete here
          // exacerbates race conditions in front-end code.  We'll return success early,
          // here, then update the password after the fact.  The worst thing that could
          // happen is that password update could fail (due to extreme load), and the
          // user will have to reset their password.
          wsapi.authenticateSession(req.session, uid, 'password');
          res.json({ success: true });

          wsapi.bcryptPassword(req.body.pass, function(err, hash) {
            if (err) {
              logger.warn("couldn't bcrypt password during email verification: " + err);
              return;
            }
            db.updatePassword(uid, hash, function(err) {
              if (err) {
                logger.warn("couldn't update password during email verification: " + err);
              }
            });
          });
        } else {
          res.json({ success: true });
        }
      }
    });
  });
};
