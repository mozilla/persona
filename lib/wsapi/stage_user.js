/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
email = require('../email.js'),
sanitize = require('../sanitize');

/* First half of account creation.  Stages a user account for creation.
 * this involves creating a secret url that must be delivered to the
 * user via their claimed email address.  Upon timeout expiry OR clickthrough
 * the staged user account transitions to a valid user account
 */

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
exports.args = ['email','pass','site'];
exports.i18n = true;

exports.process = function(req, resp) {
  var langContext = wsapi.langContext(req);

  // staging a user logs you out.
  wsapi.clearAuthenticatedUser(req.session);

  // validate
  try {
    sanitize(req.body.email).isEmail();
    sanitize(req.body.site).isOrigin();
    if(!req.body.pass) throw "missing pass";
  } catch(e) {
    var msg = "invalid arguments: " + e;
    logger.warn("bad request received: " + msg);
    return httputils.badRequest(resp, msg);
  }

  var err = wsapi.checkPassword(req.body.pass);
  if (err) {
    logger.warn("invalid password received: " + err);
    return httputils.badRequest(resp, err);
  }

  db.lastStaged(req.body.email, function (err, last) {
    if (err) return wsapi.databaseDown(resp, err);

    if (last && (new Date() - last) < config.get('min_time_between_emails_ms')) {
      logger.warn('throttling request to stage email address ' + req.body.email + ', only ' +
                  ((new Date() - last) / 1000.0) + "s elapsed");
      return httputils.throttled(resp, "Too many emails sent to that address, try again later.");
    }

    // now bcrypt the password
    wsapi.bcryptPassword(req.body.pass, function (err, hash) {
      if (err) {
        if (err.indexOf('exceeded') != -1) {
          logger.warn("max load hit, failing on auth request with 503: " + err);
          return httputils.serviceUnavailable("server is too busy");
        }
        logger.error("can't bcrypt: " + err);
        return res.json({ success: false });
      }

      try {
        // upon success, stage_user returns a secret (that'll get baked into a url
        // and given to the user), on failure it throws
        db.stageUser(req.body.email, hash, function(err, secret) {
          if (err) return wsapi.databaseDown(resp, err);

          // store the email being registered in the session data
          if (!req.session) req.session = {};

          // store the secret we're sending via email in the users session, as checking
          // that it still exists in the database is the surest way to determine the
          // status of the email verification.
          req.session.pendingCreation = secret;

          resp.json({ success: true });

          // let's now kick out a verification email!
          email.sendNewUserEmail(req.body.email, req.body.site, secret, langContext);
        });
      } catch(e) {
        // we should differentiate tween' 400 and 500 here.
        httputils.badRequest(resp, e.toString());
      }
    });
  });
};
