/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi'),
httputils = require('../httputils'),
logger = require('../logging.js').logger;

exports.method = 'post';
exports.writes_db = true;
exports.authed = 'assertion';
exports.args = {
  'email': 'email'
};
exports.i18n = false;

exports.process = function(req, res) {
  var email = req.params.email;

  db.removeEmail(req.session.userid, email, function(error) {
    if (error) {
      logger.warn("error removing email " + email);
      if (error === 'database connection unavailable') {
        wsapi.databaseDown(res, error);
      } else {
        httputils.badRequest(res, error.toString());
      }
    } else {
      res.json({ success: true });
    }});
};
