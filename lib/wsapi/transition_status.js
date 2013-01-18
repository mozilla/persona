/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
logger = require('../logging.js').logger,
httputils = require('../httputils.js');

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.args = { email: 'email' };
exports.i18n = false;

exports.process = function(req, res) {
  var email = req.params.email;

  // if the email is in the staged table, we are not complete yet.
  // if the email is not in the staged table -
  //   * if we are authenticated as the owner of the email we're done
  //   * if we are not authenticated as the owner of the email, we must auth
  db.isStaged(email, function(err, staged) {
    if (err) wsapi.databaseDown(res, err);

    if (staged) {
      return res.json({ status: 'pending' });
    } else {
      if (wsapi.isAuthed(req, 'assertion')) {
        db.userOwnsEmail(req.session.userid, email, function(err, owned) {
          if (err) wsapi.databaseDown(res, err);
          else if (owned) res.json({ status: 'complete', userid: req.session.userid });
          else res.json({ status: 'mustAuth' });
        });
      } else {
        return res.json({ status: 'mustAuth' });
      }
    }
  });
};
