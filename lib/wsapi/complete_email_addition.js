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

exports.process = function(req, res) {
  // a password *must* be supplied to this call iff the user's password
  // is currently NULL - this would occur in the case where this is the
  // first secondary address to be added to an account
  db.emailForVerificationSecret(req.body.token, function(err, r) {
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

    db.gotVerificationSecret(req.body.token, req.body.pass, function(e, email, uid) {
      if (e) {
        logger.warn("couldn't complete email verification: " + e);
        res.json({ success: false });
      } else {
        // now do we need to set the password?
        if (r.needs_password && req.body.pass) {
          wsapi.bcryptPassword(req.body.pass, function(err, hash) {
            if (err) {
              logger.warn("couldn't bcrypt password during email verification: " + err);
              return res.json({ success: false });
            }
            db.updatePassword(uid, hash, function(err) {
              if (err) {
                logger.warn("couldn't update password during email verification: " + err);
              } else {
                // XXX: what if our software 503s?  User doens't get a password set and
                // cannot change it.
                wsapi.authenticateSession(req.session, uid, 'password');
              }
              res.json({ success: !err });
            });
          });
        } else {
          res.json({ success: true });
        }
      }
    });
  });
};
