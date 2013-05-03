/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
config = require('../configuration.js'),
wsapi = require('../wsapi.js'),
wsapiutils = require('../wsapiutils');

exports.method = 'post';
exports.writes_db = false;
exports.authed = 'assertion';
exports.i18n = false;

exports.process = function(req, res) {
  wsapi.authenticateSession({session: req.session,
                             uid: req.session.userid,
                             level: req.session.auth_level,
                             duration_ms: wsapiutils.getDurationInfo(req).durationMS
                             }, function(err) {
                               if (err) return wsapi.databaseDown(res, err);
                               res.send(200);
                             });
};
