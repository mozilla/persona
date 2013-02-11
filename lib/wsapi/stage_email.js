/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
email = require('../email.js'),
config = require('../configuration');

/* Stage an email for addition to a user's account.  Causes email to be sent. */

exports.method = 'post';
exports.writes_db = true;
exports.authed = 'assertion';
exports.args = {
  email: 'email',
  site: 'origin',
  pass: {
    type: 'password',
    required: false
  }
};
exports.i18n = true;

exports.process = function(req, res) {
  // a password *must* be supplied to this call iff the user's password
  // is currently NULL - this would occur in the case where this is the
  // first secondary address to be added to an account

  db.lastStaged(req.params.email, function (err, last) {
    if (err) return wsapi.databaseDown(res, err);

    if (last && (new Date() - last) < config.get('min_time_between_emails_ms')) {
      logger.warn('throttling request to stage email address ' + req.params.email + ', only ' +
                  ((new Date() - last) / 1000.0) + "s elapsed");
      return httputils.throttled(res, "Too many emails sent to that address, try again later.");
    }

    db.checkAuth(req.session.userid, function(err, hash) {
      var needs_password = !hash;

      if (!err && needs_password && !req.params.pass) {
        err = "user must choose a password";
      }
      if (!err && !needs_password && req.params.pass) {
        err = "a password may not be set at this time";
      }

      if (err) {
        logger.info("stage of email fails: " + err);
        return res.json({
          success: false,
          reason: err
        });
      }

      if (needs_password) {
        wsapi.bcryptPassword(req.params.pass, function(err, hash) {
          if (err) {
            logger.warn("couldn't bcrypt password during email verification: " + err);
            return res.json({ success: false });
          }
          completeStage(hash);
        });
      }
      else {
        completeStage();
      }

      function completeStage(hash) {
        try {
          // on failure stageEmail may throw
          db.stageEmail(req.session.userid, req.params.email, hash, function(err, secret) {
            if (err) return wsapi.databaseDown(res, err);

            var langContext = wsapi.langContext(req);

            // store the email being added in session data
            req.session.pendingAddition = secret;

            res.json({ success: true });
            // let's now kick out a verification email!
            email.sendConfirmationEmail(req.params.email, req.params.site, secret, langContext);
          });
        } catch(e) {
          // we should differentiate tween' 400 and 500 here.
          httputils.badRequest(res, e.toString());
        }
      }
    });
  });
};
