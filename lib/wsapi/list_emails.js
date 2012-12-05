/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
logger = require('../logging.js').logger,
wsapi = require('../wsapi.js');

// returns a list of emails owned by the user:
//
// {
//   "foo@foo.com" : {..properties..}
//   ...
// }

exports.method = 'get';
exports.writes_db = false;
exports.authed = 'assertion';
exports.i18n = false;

exports.process = function(req, res) {
  logger.debug('listing emails for user ' + req.session.userid);
  db.listEmails(req.session.userid, function(err, emails) {
    if (err) wsapi.databaseDown(res, err);
    else res.json({
      success: true,
      emails: emails
    });
  });
};
