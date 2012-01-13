const
db = require('../db.js');

// return if an email is known to browserid

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.args = ['email'];
exports.i18n = false;

exports.process = function(req, resp) {
  var email = url.parse(req.url, true).query['email'];
  db.emailKnown(email, function(known) {
    resp.json({ email_known: known });
  });
};
