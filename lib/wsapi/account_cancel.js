/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger;

exports.method = 'post';
exports.writes_db = true;
exports.authed = 'assertion';

exports.process = function(req, res) {
  db.cancelAccount(req.session.userid, function(error) {
    if (error) {
      logger.error("error canceling account : " + error.toString());
      httputils.badRequest(res, error.toString());
    } else {
      res.json({ success: true });
    }});
};
