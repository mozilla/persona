/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// an internal api on the dbwriter to update "lastUsedAs".
// This is an internal api on the dbwriter, invoked by the browserid
// process when a user calls cert_key.

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
primary = require('../primary.js'),
logger = require('../logging.js').logger;

exports.method = 'post';
exports.writes_db = true;
exports.authed = 'assertion';
exports.internal = true;
exports.args = {
  email: 'email',
  used_as: 'email_type'
};

exports.i18n = false;

exports.process = function(req, res) {
  // this check is redundant. Because this is an internal API, it can only be
  // called from our software.  we expect that the browserid process forwards
  // us the user's credentials in a cookie AND double check that the authenticated
  // user owns the email address.  Expensive but safe.  Optimize later.
  db.userOwnsEmail(req.session.userid, req.params.email, function(err, owned) {
    if (err) return wsapi.databaseDown(res, err);

    if (!owned) {
      return httputils.badRequest(res, "email does not belong to authenticated user");
    }

    db.updateEmailLastUsedAs(req.params.email, req.params.used_as, function (err) {
      if (err) return wsapi.databaseDown(res, err);
      res.json({ success: true });
    });
  });
};

