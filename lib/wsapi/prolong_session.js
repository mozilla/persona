/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
config = require('../configuration.js'),
wsapi = require('../wsapi.js');

exports.method = 'post';
exports.writes_db = false;
exports.authed = 'assertion';
exports.i18n = false;

exports.process = function(req, res) {
  wsapi.authenticateSession(req.session, req.session.userid, req.session.auth_level,
                            config.get('authentication_duration_ms'));
  res.send(200);
};
