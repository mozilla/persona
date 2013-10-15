/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging/logging.js').logger,
email = require('../email.js'),
config = require('../configuration'),
cef_logger = require('../logging/cef_logger').getInstance();

/* First half of account creation.  Stages a user account for creation.
 * this involves creating a secret url that must be delivered to the
 * user via their claimed email address.  Upon timeout expiry OR clickthrough
 * the staged user account transitions to a valid user account
 */

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
exports.args = {
  'email': 'email',
  'pass': 'password',
  'allowUnverified': {
    type: 'boolean',
    required: false
  },
  'site': 'origin',
  'backgroundColor': {
    type: 'color',
    required: false
  },
  'siteLogo': {
    type: 'image',
    required: false
  }
};
exports.i18n = true;

exports.process = function(req, res) {
  var langContext = wsapi.langContext(req);

  var allowUnverified = !!req.params.allowUnverified;

  db.lastStaged(req.params.email, function (err, last) {
    if (err) return wsapi.databaseDown(res, err);

    if (last && (new Date() - last) < config.get('min_time_between_emails_ms')) {
      cef_logger.alert("EMAIL_LOAD", "Throttling email staging request",
                      req, {duser: req.params.email});
      logger.warn('throttling request to stage email address ' + req.params.email + ', only ' +
                  ((new Date() - last) / 1000.0) + "s elapsed");
      return httputils.throttled(res, "Too many emails sent to that address, try again later.");
    }

    // staging a user logs you out.
    wsapi.clearAuthenticatedUser(req.session);

    // now bcrypt the password
    wsapi.bcryptPassword(req.params.pass, function (err, hash) {
      if (err) {
        if (err.indexOf('exceeded') !== -1) {
          cef_logger.alert("LOAD_HIGH", "Load exceeded on stage request", req);
          logger.warn("max load hit, failing on auth request with 503: " + err);
          return httputils.serviceUnavailable(res, "server is too busy");
        }
        cef_logger.alert("BCRYPT_ERROR", "Error bcrypting password", req, {msg: err});
        logger.error("can't bcrypt: " + err);
        return res.json({ success: false });
      }

      try {
        if (allowUnverified) {
          // if its ok to be unverified, then create the user right now,
          // and stage their email instead.
          db.createUnverifiedUser(req.params.email, hash, function(err, uid, secret) {
            if (err) {
              cef_logger.alert("DB_FAILURE", "Cannot create unverified user; dbwriter failure", req, {msg: err});
              return wsapi.databaseDown(res, err);
            }

            if (!req.session) req.session = {};
            req.session.pendingAddition = secret;

            res.json({ success: true, unverified: true });

            email.sendConfirmationEmail(req.params.email, req.params.site, secret, langContext,
                req.params.backgroundColor, req.params.siteLogo);
          });
        } else {
          // the typical flow

          // upon success, stage_user returns a secret (that'll get baked into a url
          // and given to the user), on failure it throws
          db.stageUser(req.params.email, hash, function(err, secret) {
            if (err) {
              cef_logger.alert("DB_FAILURE", "Cannot stage user; dbwriter failure", req, {msg: err});
              return wsapi.databaseDown(res, err);
            }

            // store the email being registered in the session data
            if (!req.session) req.session = {};

            // store the secret we're sending via email in the users session, as checking
            // that it still exists in the database is the surest way to determine the
            // status of the email verification.
            req.session.pendingCreation = secret;

            res.json({ success: true });
            logger.info('stage_user.success');

            // let's now kick out a verification email!
            email.sendNewUserEmail(req.params.email, req.params.site, secret, langContext,
                req.params.backgroundColor, req.params.siteLogo);
          });
        }
      } catch(e) {
        // we should differentiate tween' 400 and 500 here.
        logger.error(e);
        httputils.badRequest(res, String(e));
      }
    });
  });
};
