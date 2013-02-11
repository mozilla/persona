/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
httputils = require('../httputils.js'),
logger = require('../logging.js').logger;

/* Given a verification secret (a "token", delivered via email), return the
 * email address associated with this token.
 *
 * This call also returns a hint to the UI, regarding whether completing the
 * email verification that this token will require the user to enter their
 * password.
 *
 * These two things are conflated into a single call as a performance
 * optimization.
 */

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.args = {
  'token': 'token'
};
exports.i18n = false;

exports.process = function(req, res) {

  db.emailForVerificationSecret(req.params.token, function(err, email, uid, passwd) {
    if (err) {
      if (err === 'database unavailable') {
        return httputils.serviceUnavailable(res, err);
      } else {
        return res.json({
          success: false,
          reason: err
        });
      }
    }

    var needs_password = !passwd;

    // now let's determine whether the user must authenticate.
    var must_auth = true;

    // If the user is on the same browser they do not have to authenticate if
    // they're doing one of the following:
    // 1. resetting their password
    // 2. creating an account
    if ((req.params.token === req.session.pendingCreation) ||
        (req.params.token === req.session.pendingReset))
    {
      must_auth = false;
    }

    // If the user is on the same browser AND authenticated they do not have to
    // authenticate when doing one of the following:
    // 1. re-verifying an email after password reset
    // 2. confirming a new email they want to add to their account
    if (req.params.token === req.session.pendingReverification ||
        req.params.token === req.session.pendingAddition)
    {
      must_auth = !(req.session.userid && req.session.userid === uid);
    }

    res.json({
      success: true,
      email: email,
      must_auth: must_auth,
      needs_password: needs_password
    });
  });
};
