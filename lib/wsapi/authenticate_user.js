const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
bcrypt = require('bcrypt'),
http = require('http'),
https = require('https'),
querystring = require('querystring');

exports.method = 'post';
exports.writes_db = false;
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
        res.json({ success: false });
      } else if (!success) {
        res.json({ success: false });
      } else {
        if (!req.session) req.session = {};
        wsapi.setAuthenticatedUser(req.session, req.body.email);

        res.json({ success: true });

        // if the work factor has changed, update the hash here.  issue #204
        // NOTE: this runs asynchronously and will not delay the response
        if (config.get('bcrypt_work_factor') != bcrypt.get_rounds(hash)) {
          logger.info("updating bcrypted password for email " + req.body.email);

          // this request must be forwarded to dbwriter, and we'll use the
          // authentication cookie of the user just sent out.
          var u = wsapi.fowardWritesTo;

          var m = u.scheme === 'http' ? http : https;

          var post_body = querystring.stringify({
            oldpass: req.body.pass,
            newpass: req.body.pass,
            csrf: req.body.csrf
          });

          var preq = m.request({
            host: u.host,
            port: u.port,
            path: '/wsapi/update_password',
            method: "POST",
            headers: {
              'Cookie': res.getHeader('set-cookie'),
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': post_body.length
            }
          }, function(pres) {
            pres.on('end', function() {
              if (pres.statusCode !== 200) {
                logger.error("failed to update bcrypt rounds of password for " + req.body.email + " dbwriter returns " + pres.statusCode);
              } else {
                logger.info("bcrypt rounds of password for " + req.body.email + " successfully updated " +
                            "(from " + bcrypt.get_rounds(hash) + " to " + config.get('bcrypt_work_factor') + ")");
              }
            });
          }).on('error', function(e) {
            logger.error("failed to update bcrypt rounds of password for " + req.body.email + ": " + e);
          });

          preq.write(post_body);
          preq.end();
        }
      }
    });
  });
};
