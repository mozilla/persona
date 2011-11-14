const
db = require('../db.js'),
logger = require('../logging.js').logger;

exports.method = 'post';
exports.writes_db = true;
// XXX: see issue #290 - we want to require authentication here and update frontend code
exports.authed = false;
exports.args = ['token'];

exports.process = function(req, res) {
  db.gotVerificationSecret(req.body.token, undefined, function(e) {
    if (e) {
      logger.warn("couldn't complete email verification: " + e);
      res.json({ success: false });
    } else {
      res.json({ success: true });
    }
  });
};
