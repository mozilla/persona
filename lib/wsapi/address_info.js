const
db = require('../db.js'),
primary = require('../primary.js');

// return information about an email address.
//   type:  is this an address with 'primary' or 'secondary' support?
//   if type is 'secondary':
//     known: is this address known to browserid?
//   if type is 'primary':
//     auth: what is the url to send the user to for authentication
//     prov: what is the url to embed for silent certificate (re)provisioning

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.args = ['email'];
exports.i18n = false;

const emailRegex = /\@(.*)$/;

exports.process = function(req, resp) {
  // parse out the domain from the email
  var email = url.parse(req.url, true).query['email'];
  var m = emailRegex.exec(email);
  if (!m) {
    resp.sendHeader(400);
    resp.json({ "error": "invalid email address" });
    return;
  }

  primary.checkSupport(m[1], function(err, rv) {
    if (err) {
      logger.warn('error checking "' + m[1] + '" for primary support: ' + err);
      resp.sendHeader(500);
      resp.json({ "error": "can't check email address" });
      return;
    }

    if (rv) {
      rv.type = 'primary';
      resp.json(rv);
    } else {
      db.emailKnown(email, function(known) {
        resp.json({
          type: 'secondary',
          known: known
        });
      });
    }
  });
};
