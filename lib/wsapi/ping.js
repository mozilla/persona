/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const db = require('../db.js');

exports.method = 'get';
exports.writes_db = false;
exports.i18n = false;

exports.process = function(req, res) {
  db.ping(function(err) {
    if (err) res.send("fail", 500);
    else res.send("ok",200);
  });
};
