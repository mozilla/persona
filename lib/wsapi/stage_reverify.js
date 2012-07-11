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

/* Stage an email for re-verification (i.e. after account password reset).
 * Causes an email to be sent. */

exports.method = 'post';
exports.writes_db = true;
exports.authed = 'assertion';
exports.args = {
  email: 'email',
  site: 'origin'
};
exports.i18n = true;

exports.process = function(req, res) {
  // Note, we do no throttling of emails in this case.  Because this call requires
  // authentication, protect a user from themselves could cause more harm than good,
  // specifically we would be removing a user available workaround (i.e. a cosmic ray
  // hits our email delivery, user doesn't get an email in 30s.  User tries again.)

  // one may only reverify an email that is owned and unverified
  db.userOwnsEmail(req.session.userid, req.params.email, function(err, owned) {
    if (err) return res.json({ success: false, reason: err });
    if (!owned) return res.json({ success: false, reason: 'you don\'t control that email address' });

    db.emailIsVerified(req.params.email, function(err, verified) { 
      if (err) return res.json({ success: false, reason: err });
      if (verified) return res.json({ success: false, reason: 'email is already verified' });

      try {
        // on failure stageEmail may throw
        db.stageEmail(req.session.userid, req.params.email, undefined, function(err, secret) {
          if (err) return wsapi.databaseDown(res, err);

          var langContext = wsapi.langContext(req);
          
          // store the email being reverified
          req.session.pendingReverification = secret;
          
          res.json({ success: true });
          // let's now kick out a verification email!
          email.sendConfirmationEmail(req.params.email, req.params.site, secret, langContext);
        });
      } catch(e) {
        // we should differentiate tween' 400 and 500 here.
        httputils.badRequest(res, e.toString());
      }
    });
  });
};
