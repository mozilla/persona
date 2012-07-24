/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi'),
logger = require('../logging.js').logger,
cef_logger = require('../cef_logger').getInstance(),
mergeEnv = require('../cef_logger').mergeWithHttpEnv;

exports.method = 'post';
exports.writes_db = true;
exports.authed = 'assertion';
exports.i18n = false;

exports.process = function(req, res) {
  db.cancelAccount(req.session.userid, function(error) {
    if (error) {
      cef_logger.alert("ACCOUNT_CANCEL", "Error canceling account",
                      mergeEnv(req, {duser: req.session.userid, msg: error}));
      wsapi.databaseDown(res, error);
    } else {
      cef_logger.warn("ACCOUNT_CANCEL", "Canceled user account",
                      mergeEnv(req, {duser: req.session.userid}));
      res.json({ success: true });
    }});
};
