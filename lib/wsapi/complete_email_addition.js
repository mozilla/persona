const
db = require('../db.js'),
logger = require('../logging.js').logger;

exports.method = 'post';
exports.writes_db = true;
// XXX: see issue #290 - we want to require authentication here and update frontend code
exports.authed = true;
exports.args = ['token'];

exports.process = function(req, res) {
  // a password *must* be supplied to this call iff the user's password
  // is currently NULL - this would occur in the case where this is the
  // first secondary address to be added to an account
  db.checkAuth

  db.gotVerificationSecret(req.body.token, undefined, function(e) {
    if (e) {
      logger.warn("couldn't complete email verification: " + e);
      res.json({ success: false });
    } else {
      res.json({ success: true });
    }
  });
};
