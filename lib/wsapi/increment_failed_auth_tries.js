/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js');

exports.method = 'get';
exports.writes_db = true;
exports.authed = false;
exports.internal = true;
exports.args = {
  userid: 'userid'
};
exports.i18n = false;

exports.process = function(req, res) {
  db.incAuthFailures(req.params.userid, function(err) {
    if (err) return wsapi.databaseDown(res);
    res.json({ success: true });
  });
};

