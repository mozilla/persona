/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
primary = require('../primary.js'),
logger = require('../logging.js').logger;

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
exports.internal = true;
exports.args = {
  assertion: 'assertion'
};
exports.i18n = false;

exports.process = function(req, res) {
  // let's (re)verify that the assertion is valid
  primary.verifyAssertion(req.params.assertion, function(err, email) {
    if (err) {
      // this should not be an error, the assertion should have already been
      // tested on the webhead
      logger.error('verfication of primary assertion failed unexpectedly dbwriter (' + err + '): ' +
                   req.params.assertion);

      return httputils.serverError(res);
    }

    db.createUserWithPrimaryEmail(email, function(err, uid) {
      if (err) return wsapi.databaseDown(res);
      res.json({ success: true, userid: uid });
    });
  });
};
