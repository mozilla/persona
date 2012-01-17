/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
logger = require('../logging.js').logger;

// returns a list of emails owned by the user:
//
// {
//   "foo@foo.com" : {..properties..}
//   ...
// }

exports.method = 'get';
exports.writes_db = false;
exports.authed = 'assertion';

exports.process = function(req, resp) {
  logger.debug('listing emails for user ' + req.session.userid);
  db.listEmails(req.session.userid, function(err, emails) {
    if (err) httputils.serverError(resp, err);
    else resp.json(emails);
  });
};
