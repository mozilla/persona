const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
bcrypt = require('bcrypt');

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
exports.args = ['email','pass'];

exports.process = function(req, res) {
  db.checkAuth(req.body.email, function(hash) {
    if (typeof hash !== 'string' || typeof req.body.pass !== 'string')
    {
      return res.json({ success: false });
    }

    bcrypt.compare(req.body.pass, hash, function (err, success) {
      if (err) {
        logger.warn("error comparing passwords with bcrypt: " + err);
        success = false;
      }
      if (success) {
        if (!req.session) req.session = {};
        wsapi.setAuthenticatedUser(req.session, req.body.email);

        // if the work factor has changed, update the hash here.  issue #204
        // NOTE: this runs asynchronously and will not delay the response
        if (config.get('bcrypt_work_factor') != bcrypt.get_rounds(hash)) {
          logger.info("updating bcrypted password for email " + req.body.email);
          wsapi.bcryptPassword(req.body.pass, function(err, hash) {
            db.updatePassword(req.body.email, hash, function(err) {
              if (err) {
                logger.error("error updating bcrypted password for email " + req.body.email, err);
              }
            });
          });
        }
      }
      res.json({ success: success });
    });
  });
};
