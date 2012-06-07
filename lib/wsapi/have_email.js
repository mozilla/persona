/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
url = require('url');

// return if an email is known to browserid

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.args = ['email'];
exports.i18n = false;

exports.process = function(req, res) {
  var email = url.parse(req.url, true).query['email'];
  db.emailKnown(email, function(err, known) {
    if (err) return wsapi.databaseDown(res, err);
    res.json({ email_known: known });
  });
};
