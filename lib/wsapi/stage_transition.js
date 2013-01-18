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

/* Stage an email address that is transitioning from a primary to a secondary
 * and doesn't have a password.
 */

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
exports.args = {
  email: 'email',
  site:  'origin',
  pass:  'password'
};
exports.i18n = true;

exports.process = function(req, res) {
  db.lastStaged(req.params.email, function (err, last) {
    if (err) return wsapi.databaseDown(res, err);

    if (last && (new Date() - last) < config.get('min_time_between_emails_ms')) {
      logger.warn('throttling request to stage email address ' + req.params.email + ', only ' +
                  ((new Date() - last) / 1000.0) + "s elapsed");
      return httputils.throttled(res, "Too many emails sent to that address, try again later.");
    }

    db.emailToUID(req.params.email, function(err, uid) {
      if (err) {
        logger.info("reset password fails: " + err);
        return res.json({ success: false });
      }

      if (!uid) {
        return res.json({
          reason: "No such email address.",
          success: false
        });
      }

      // staging a user logs you out.
      wsapi.clearAuthenticatedUser(req.session);

      // now bcrypt the password
      wsapi.bcryptPassword(req.params.pass, function (err, hash) {
        if (err) {
          if (err.indexOf('exceeded') !== -1) {
            logger.warn("max load hit, failing on auth request with 503: " + err);
            return httputils.serviceUnavailable(res, "server is too busy");
          }
          logger.error("can't bcrypt: " + err);
          return res.json({ success: false });
        }

        // on failure stageEmail may throw
        try {
          db.stageEmail(uid, req.params.email, hash, function(err, secret) {
            if (err) return wsapi.databaseDown(res, err);

            var langContext = wsapi.langContext(req);

            // store the email being added in session data
            req.session.pendingReset = secret;
            
            res.json({ success: true });

            // let's now kick out a verification email!
            email.sendTransitionEmail(req.params.email, req.params.site, secret, langContext);
          });
        } catch(e) {
          // we should differentiate tween' 400 and 500 here.
          httputils.badRequest(res, e.toString());
        }
      });
    });
  });
};
