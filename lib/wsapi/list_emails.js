const
db = require('../db.js'),
logger = require('../logging.js').logger;

// returns a list of emails owned by the user:
//
// {
//   "foo@foo.com" : {..properties..}
//   ...
// }

exports.method = 'get';
exports.writes_db = false;
exports.authed = true;

exports.process = function(req, resp) {
  logger.debug('listing emails for ' + req.session.authenticatedUser);
  db.listEmails(req.session.authenticatedUser, function(err, emails) {
    if (err) httputils.serverError(resp, err);
    else resp.json(emails);
  });
};
