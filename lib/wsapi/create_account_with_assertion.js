const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
primary = require('../primary.js'),
logger = require('../logging.js').logger;

exports.method = 'post';
exports.writes_db = true;
exports.authed = false;
exports.disallow_forward = true;
exports.args = ['assertion'];

exports.process = function(req, res) {
  // let's (re)verify that the assertion is valid
  primary.verifyAssertion(req.body.assertion, function(err, email) {
    if (err) {
      // this should not be an error, the assertion should have already been
      // tested on the webhead
      logger.error('verfication of primary assertion failed unexpectedly dbwriter (' + err + '): ' + req.body.assertion);
      return httputils.serverError(res);
    }

    db.createUserWithPrimaryEmail(email, function(err, uid) {
      if (err) {
        // yikes.  couldn't write database?
        logger.error('error creating user with primary email address for "'+email+'": ' + err);
        return httputils.serverError(res);
      }
      res.json({ success: true, userid: uid });
    });
  });
};
