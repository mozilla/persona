/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js');

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
  db.emailForVerificationSecret(req.query.token, function(err, r) {
    if (err) {
      res.json({
        success: false,
        reason: err
      });
    } else {
      res.json({
        success: true,
        email: r.email,
        needs_password: r.needs_password
      });
    }
  });
};
