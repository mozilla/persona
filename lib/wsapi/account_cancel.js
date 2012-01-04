const
db = require('../db.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger;

exports.method = 'post';
exports.writes_db = true;
exports.authed = true;

exports.process = function(req, res) {
  db.cancelAccount(req.session.userid, function(error) {
    if (error) {
      logger.error("error canceling account : " + error.toString());
      httputils.badRequest(res, error.toString());
    } else {
      res.json({ success: true });
    }});
};
