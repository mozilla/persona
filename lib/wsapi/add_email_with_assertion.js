/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
querystring = require('querystring'),
primary = require('../primary.js'),
http = require('http'),
https = require('https');

exports.method = 'post';
exports.writes_db = true;
exports.authed = 'assertion';
exports.args = {
  'assertion': 'assertion'
};
exports.i18n = false;

// This WSAPI will be invoked when a user attempts to add a primary
// email address to their browserid account.  They must already be
// authenticated.
exports.process = function(req, res) {
  // first let's verify that the assertion is valid
  primary.verifyAssertion(req.params.assertion, function(err, email) {
    if (err) {
      return res.json({
        success: false,
        reason: err.toString()
      });
    }

    // user is authenticated as req.session.userid (their numeric user "id"),
    // and they've proved, via assertion, that they own 'email'.  Let's add
    // that email to their account, removing it from others accounts if required.
    db.addPrimaryEmailToAccount(req.session.userid, email, function(err) {
      if (err) {
        logger.warn('cannot add primary email "' + email + '" to acct with uid "'
                    + req.session.userid + '": ' + err);
        return wsapi.databaseDown(res, err);
      }

      // success!
      logger.info('added email "' + email + '" to acct with uid "'
                  + req.session.userid + '"');
      return res.json({ success: true });
    });
  });
};
