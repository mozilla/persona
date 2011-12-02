const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
bcrypt = require('../bcrypt');

exports.method = 'post';
exports.writes_db = true;
exports.authed = true;
exports.args = ['oldpass','newpass'];

exports.process = function(req, res) {
  db.checkAuth(req.session.authenticatedUser, function(hash) {
    if (typeof hash !== 'string' || typeof req.body.oldpass !== 'string')
    {
      return res.json({ success: false });
    }

    bcrypt.compare(req.body.oldpass, hash, function (err, success) {
      if (err) {
        logger.warn("error comparing passwords with bcrypt: " + err);
        return res.json({ success: false });
      }

      logger.info("updating password for email " + req.session.authenticatedUser);
      wsapi.bcryptPassword(req.body.newpass, function(err, hash) {
        if (err) {
          logger.error("error bcrypting  password for password update for " + req.body.email, err);
          return res.json({ success: false });
        }

        db.updatePassword(req.session.authenticatedUser, hash, function(err) {
          var success = true;
          if (err) {
            logger.error("error updating bcrypted password for email " + req.body.email, err);
            success = false;
          }
          return res.json({ success: success });
        });
      });
    });
  });
};
