/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
wsapi = require('../wsapi.js'),
cef_logger = require('../cef_logger').getInstance();

exports.method = 'post';
exports.writes_db = false;
exports.authed = 'assertion';
exports.i18n = false;

exports.process = function(req, res) {
  wsapi.clearAuthenticatedUser(req.session);
  cef_logger.info("USER_LOGOUT", "User logout", req);
  res.json({ success: true });
};
