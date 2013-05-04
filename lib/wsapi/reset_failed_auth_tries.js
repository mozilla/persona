/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js');

exports.method = 'get';
exports.writes_db = true;
exports.authed = true;
exports.internal = true;
exports.args = {};
exports.i18n = false;

exports.process = function(req, res) {
  db.clearAuthFailures(req.session.userid, function(err) {
    if (err) return wsapi.databaseDown(res);
    res.json({ success: true });
  });
};

