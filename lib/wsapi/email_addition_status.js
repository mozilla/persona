/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js');

/* First half of account creation.  Stages a user account for creation.
 * this involves creating a secret url that must be delivered to the
 * user via their claimed email address.  Upon timeout expiry OR clickthrough
 * the staged user account transitions to a valid user account
 */

exports.method = 'get';
exports.writes_db = false;
exports.authed = 'assertion';
exports.args = { email: 'email' };
exports.i18n = false;

exports.process = function(req, res) {
  var email = req.params.email;

  // check if the currently authenticated user has the email stored under pendingAddition
  // in their acct.
  db.userOwnsEmail(
    req.session.userid,
    email,
    function(err, registered) {
      if (err) {
        wsapi.databaseDown(res, err);
      } else if (registered) {
        delete req.session.pendingAddition;
        res.json({ status: 'complete' });
      } else if (!req.session.pendingAddition) {
        res.json({ status: 'failed' });
      } else {
        db.haveVerificationSecret(req.session.pendingAddition, function (err, known) {
          if (err) {
            return wsapi.databaseDown(res, err);
          } else if (known) {
            return res.json({ status: 'pending' });
          } else {
            delete req.session.pendingAddition;
            res.json({ status: 'failed' });
          }
        });
      }
    });
};
