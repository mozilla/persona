/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
logger = require('../logging.js').logger,
wsapi = require('../wsapi.js'),
bcrypt = require('../bcrypt.js'),
httputils = require('../httputils.js'),
config = require('../configuration.js');

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
// NOTE: this API also takes a 'pass' parameter which is required
// when a user has a null password (only primaries on their acct)
exports.args = {
  'token': 'token',
  'pass': {
    type: 'password',
    required: false
  }
};
exports.i18n = true;

exports.process = function(req, res) {
  // in order to complete a transition, one of the following must be true:
  //
  // 1. you are using the same browser to complete the email verification as you
  //    used to start it
  // 2. you have provided the password chosen by the initiator of the verification
  //    request

  // is this the same browser?
  if (req.params.token === req.session.pendingReset) {
    return postAuthentication();
  }
  // is a password provided?
  else if (typeof req.params.pass === 'string') {
    return db.authForVerificationSecret(req.params.token, function(err, hash) {
      if (err) {
        logger.warn("couldn't get password for verification secret: " + err);
        return wsapi.databaseDown(res, err);
      }

      bcrypt.compare(req.params.pass, hash, function (err, success) {
        if (err) {
          logger.warn("max load hit, failing on auth request with 503: " + err);
          return httputils.serviceUnavailable(res, "server is too busy");
        } else if (!success) {
          return httputils.authRequired(res, "password mismatch");
        } else {
          return postAuthentication();
        }
      });
    });
  } else {
    return httputils.authRequired(res, 'Provide your password');
  }

  function postAuthentication() {
    db.haveVerificationSecret(req.params.token, function(err, known) {
      if (err) return wsapi.databaseDown(res, err);

      if (!known) {
        // clear the pendingReset token from the session if we find no such
        // token in the database
        delete req.session.pendingReset;
        return res.json({ success: false} );
      }

      db.completePasswordReset(req.params.token, null, function(err, email, uid) {
        if (err) {
          logger.warn("couldn't complete email verification: " + err);
          wsapi.databaseDown(res, err);
        } else {
          // clear the pendingReset token from the session once we
          // successfully complete password reset
          delete req.session.pendingReset;

          // At this point, the user is either on the same browser with a token from
          // their email address, OR they've provided their account password.  It's
          // safe to grant them an authenticated session.
          wsapi.authenticateSession({session: req.session,
                                     uid: uid,
                                     level: 'password',
                                     duration_ms: config.get('ephemeral_session_duration_ms')
                                    }, function(err) {
            if (err) return wsapi.databaseDown(res, err);
            res.json({ success: true });
          });
        }
      });
    });
  }
};
