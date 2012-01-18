/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js');

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.args = ['email'];
exports.i18n = false;

exports.process = function(req, res) {
  var email = req.query.email;

  // if the user is authenticated as the user in question, we're done
  if (wsapi.isAuthed(req, 'assertion')) {
    db.userOwnsEmail(req.session.userid, email, function(owned) {
      if (owned) res.json({ status: 'complete' });
      else notAuthed();
    });
  } else {
    notAuthed()
  }

  function notAuthed() {
    // if the user isn't authenticated and there's no pendingCreation token,
    // then they must authenticate
    if (!req.session.pendingCreation) {
      return res.json({ status: 'mustAuth' });
    }

    // if the secret is still in the database, it hasn't yet been verified and
    // verification is still pending
    db.haveVerificationSecret(req.session.pendingCreation, function (known) {
      if (known) return res.json({ status: 'pending' });
      // if the secret isn't known, and we're not authenticated, then the user must authenticate
      // (maybe they verified the URL on a different browser, or maybe they canceled the account
      // creation)
      else {
        delete req.session.pendingCreation;
        res.json({ status: 'mustAuth' });
      }
    });
  }
};
