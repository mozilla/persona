/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi'),
logger = require('../logging.js').logger;

exports.method = 'post';
exports.writes_db = true;
exports.authed = 'assertion';
exports.i18n = false;

exports.process = function(req, res) {
  db.cancelAccount(req.session.userid, function(error) {
    if (error) {
      wsapi.databaseDown(res, error);
    } else {
      res.json({ success: true });
    }});
};
