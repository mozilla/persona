/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
bcrypt = require('../bcrypt');

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
exports.args = ['token'];
exports.i18n = false;

exports.process = function(req, res) {
  // in order to complete a user creation, one of the following must be true:
  //
  // 1. you are using the same browser to complete the email verification as you
  //    used to start it
  // 2. you have provided the password chosen by the initiator of the verification
  //    request
  //
  // These protections guard against the case where an attacker can send out a bunch
  // of verification emails, wait until a distracted internet user clicks on one,
  // and then control a browserid account that they can use to prove they own
  // the email address of the attacked.

  // TRANSITIONAL CODE COMMENT
  // for issue 1000 we moved initial password selection to the browserid dialog (from
  // the verification page).  Rolling out this change causes some temporal pain.
  // Outstannding verification links sent before the change was deployed will have
  // new user requests without passwords.  When the verification page is loaded for
  // these links, we prompt the user for a password.  That password is sent up with
  // the request.  this code and comment should all be purged after the new code
  // has been in production for 2 weeks.
  // END TRANSITIONAL CODE COMMENT

  // is this the same browser?
  if (typeof req.session.pendingCreation === 'string' &&
      req.body.token === req.session.pendingCreation) {
    return postAuthentication();
  }
  // is a password provided?
  else if (typeof req.body.pass === 'string') {
    return db.authForVerificationSecret(req.body.token, function(err, hash) {
      // TRANSITIONAL CODE
      // if hash is null, no password was provided during verification and
      // this is an old-style verification.  We accept the password and will
      // update it after the verification is complete.
      if (err == 'no password for user' || !hash) return postAuthentication();
      // END TRANSITIONAL CODE

      if (err) {
        logger.warn("couldn't get password for verification secret: " + err);
        return wsapi.databaseDown(res, err);
      }

      bcrypt.compare(req.body.pass, hash, function (err, success) {
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
    // the time the email verification is performed, we'll clear the pendingCreation
    // data on the session.
    delete req.session.pendingCreation;

    db.haveVerificationSecret(req.body.token, function(err, known) {
      if (err) return wsapi.databaseDown(res, err);

      if (!known) return res.json({ success: false} );

      // TRANSITIONAL CODE
      // user is authorized (1 or 2 above) OR user has no password set, in which
      // case for a short time we'll accept the password provided with the verification
      // link, and set it as theirs.
      var transitionalPassword = null;

      db.authForVerificationSecret(req.body.token, function(err, hash) {
        if (err == 'no password for user' || !hash) {
          if (!req.body.pass) return httputils.authRequired(res, "password required");
          err = wsapi.checkPassword(req.body.pass);
          if (err) {
            logger.warn("invalid password received: " + err);
            return httputils.badRequest(res, err);
          }
          transitionalPassword = req.body.pass;
        }
        completeCreation();
      });
      // END TRANSITIONAL CODE

      function completeCreation() {
        db.gotVerificationSecret(req.body.token, function(err, email, uid) {
          if (err) {
            logger.warn("couldn't complete email verification: " + err);
            wsapi.databaseDown(res, err);
          } else {
            // FIXME: not sure if we want to do this (ba)
            // at this point the user has set a password associated with an email address
            // that they've verified.  We create an authenticated session.
            wsapi.authenticateSession(req.session, uid, 'password',
                                      config.get('ephemeral_session_duration_ms'));
            res.json({ success: true });

            // TRANSITIONAL CODE
            if (transitionalPassword) {
              wsapi.bcryptPassword(transitionalPassword, function(err, hash) {
                if (err) {
                  logger.warn("couldn't bcrypt pass for old verification link: " + err);
                  return;
                }

                db.updatePassword(uid, hash, function(err) {
                  if (err) {
                    logger.warn("couldn't bcrypt pass for old verification link: " + err);
                  }
                });
              });
            }
            // END TRANSITIONAL CODE
          }
        });
      }
    });
  }
};
