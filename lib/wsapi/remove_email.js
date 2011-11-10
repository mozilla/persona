const
db = require('../db.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger;

exports.method = 'post';
exports.writes_db = true;
exports.authed = true;
exports.args = ['email'];

exports.process = function(req, res) {
  var email = req.body.email;

  db.removeEmail(req.session.authenticatedUser, email, function(error) {
    if (error) {
      logger.error("error removing email " + email);
      httputils.badRequest(res, error.toString());
    } else {
      res.json({ success: true });
    }});
};
