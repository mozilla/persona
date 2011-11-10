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
exports.authed = true;
exports.args = ['email','site'];

exports.process = function(req, res) {
  db.lastStaged(req.body.email, function (last) {
    if (last && (new Date() - last) < config.get('min_time_between_emails_ms')) {
      logger.warn('throttling request to stage email address ' + req.body.email + ', only ' +
                  ((new Date() - last) / 1000.0) + "s elapsed");
      return httputils.forbidden(res, "throttling.  try again later.");
    }

    try {
      // on failure stageEmail may throw
      db.stageEmail(req.session.authenticatedUser, req.body.email, function(secret) {

        // store the email being added in session data
        req.session.pendingAddition = secret;

        res.json({ success: true });

        // let's now kick out a verification email!
        email.sendAddAddressEmail(req.body.email, req.body.site, secret);
      });
    } catch(e) {
      // we should differentiate tween' 400 and 500 here.
      httputils.badRequest(res, e.toString());
    }
  });
};
