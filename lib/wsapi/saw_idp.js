/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// update the 'idp' table noting that an idp was recently "seen",
// that they serve a valid support document.  This is an internal
// api on the dbwriter, invoked by the browserid process when
// checking idps.

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
primary = require('../primary.js'),
logger = require('../logging.js').logger;

exports.method = 'get';
exports.writes_db = true;
exports.authed = false;
exports.internal = true;
exports.args = {
  domain: 'hostname'
};
exports.i18n = false;

exports.process = function(req, res) {
  db.updateIDPLastSeen(req.params.domain, function(err) {
    if (err) return wsapi.databaseDown(res);
    res.json({ success: true });
  });
};

