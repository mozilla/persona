/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
cef_logger = require('../cef_logger').getInstance(),
mergeEnv = require('../cef_logger').mergeWithHttpEnv;

exports.method = 'post';
exports.writes_db = true;
exports.authed = 'assertion';
exports.args = {
  'email': 'email'
};
exports.i18n = false;

exports.process = function(req, res) {
  var email = req.params.email;

  db.removeEmail(req.session.userid, email, function(error) {
    if (error) {
      cef_logger.alert("REMOVE_EMAIL", "Error removing email",
                      mergeEnv(req, {duser: req.session.userid, msg: error}));
      logger.warn("error removing email " + email);
      if (error === 'database connection unavailable') {
        wsapi.databaseDown(res, error);
      } else {
        httputils.badRequest(res, error.toString());
      }
    } else {
      cef_logger.info("REMOVE_EMAIL", "Removed user email",
                     mergeEnv(req, {duser: req.session.userid}));
      res.json({ success: true });
    }});
};
