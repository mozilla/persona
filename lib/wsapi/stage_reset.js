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

/* First half of account creation.  Stages a user account for creation.
 * this involves creating a secret url that must be delivered to the
 * user via their claimed email address.  Upon timeout expiry OR clickthrough
 * the staged user account transitions to a valid user account
 */

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
exports.args = {
  email: 'email',
  site:  'origin'
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

      // on failure stageEmail may throw
      try {
        db.stageEmail(uid, req.params.email, null, function(err, secret) {
          if (err) return wsapi.databaseDown(res, err);

          var langContext = wsapi.langContext(req);

          // store the email being added in session data
          req.session.pendingReset = secret;

          res.json({ success: true });

          // let's now kick out a verification email!
          email.sendForgotPasswordEmail(req.params.email, req.params.site, secret, langContext);
        });
      } catch (e) {
        // we should differentiate tween' 400 and 500 here.
        httputils.badRequest(res, e.toString());
      }
    });
  });
};
