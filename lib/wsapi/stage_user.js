const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
email = require('../email.js');

/* First half of account creation.  Stages a user account for creation.
 * this involves creating a secret url that must be delivered to the
 * user via their claimed email address.  Upon timeout expiry OR clickthrough
 * the staged user account transitions to a valid user account
 */

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
exports.args = ['email','site'];

exports.process = function(req, resp) {
  // staging a user logs you out.
  wsapi.clearAuthenticatedUser(req.session);

  db.lastStaged(req.body.email, function (last) {
    if (last && (new Date() - last) < config.get('min_time_between_emails_ms')) {
      logger.warn('throttling request to stage email address ' + req.body.email + ', only ' +
                  ((new Date() - last) / 1000.0) + "s elapsed");
      return httputils.forbidden(resp, "throttling.  try again later.");
    }

    try {
      // upon success, stage_user returns a secret (that'll get baked into a url
      // and given to the user), on failure it throws
      db.stageUser(req.body.email, function(secret) {
        // store the email being registered in the session data
        if (!req.session) req.session = {};

        // store the secret we're sending via email in the users session, as checking
        // that it still exists in the database is the surest way to determine the
        // status of the email verification.
        req.session.pendingCreation = secret;

        resp.json({ success: true });

        // let's now kick out a verification email!
        email.sendNewUserEmail(req.body.email, req.body.site, secret);
      });
    } catch(e) {
      // we should differentiate tween' 400 and 500 here.
      httputils.badRequest(resp, e.toString());
    }
  });
};
