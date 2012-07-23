/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js');

/* A polled API which returns whether the user has completed reverification
 * of an email address
 */

exports.method = 'get';
exports.writes_db = false;
exports.authed = 'assertion';
exports.args = { email: 'email' };
exports.i18n = false;

exports.process = function(req, res) {

  // For simplicity, all we check is if an email is verified.  We do not check that
  // the email is owned by the currently authenticated user, nor that the verification
  // secret still exists.  These checks would require more database interactions, and
  // other calls will fail in such circumstances.
  db.emailIsVerified(req.params.email, function(err, verified) {
    if (err) return wsapi.databaseDown(res, err);
    res.json({ status: verified ? 'complete' : 'pending' });
  });
};
