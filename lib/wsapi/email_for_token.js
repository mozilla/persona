/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
httputils = require('../httputils.js');

/* First half of account creation.  Stages a user account for creation.
 * this involves creating a secret url that must be delivered to the
 * user via their claimed email address.  Upon timeout expiry OR clickthrough
 * the staged user account transitions to a valid user account
 */

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.args = ['token'];
exports.i18n = false;

exports.process = function(req, res) {
  db.emailForVerificationSecret(req.query.token, function(err, email, uid, hash) {
    if (err) {
      if (err === 'database unavailable') {
        httputils.serviceUnavailable(res, err);
      } else {
        res.json({
          success: false,
          reason: err
        });
      }
    } else {
      function checkMustAuth() {
        // must the user authenticate?  This is true if they are not authenticated
        // as the uid who initiated the verification, and they are not on the same
        // browser as the initiator
        var must_auth = true;

        if (uid && req.session.userid === uid) {
          must_auth = false;
        }
        else if (!uid && typeof req.session.pendingCreation === 'string' &&
                 req.query.token === req.session.pendingCreation) {
          must_auth = false;
        }

        res.json({
          success: true,
          email: email,
          must_auth: must_auth
        });
      }

      // backwards compatibility - issue #1592
      // if there is no password in the user record, and no password in the staged
      // table, then we require a password be fetched from the user upon verification.
      // these checks are temporary and should disappear in 1 trains time.
      function needsPassword() {
        // no password is set neither in the user table nor in the staged record.
        // the user must pick a password
        res.json({
          success: true,
          email: email,
          needs_password: true
        });
      }

      if (!hash) {
        if (!uid) {
          needsPassword();
        } else {
          db.checkAuth(uid, function(err, hash) {
            if (err) {
              return res.json({
                success: false,
                reason: err
              });
            }

            if (!hash) {
              needsPassword();
            } else {
              checkMustAuth();
            }
          });
        }
      } else {
        checkMustAuth();
      }

    }
  });
};
