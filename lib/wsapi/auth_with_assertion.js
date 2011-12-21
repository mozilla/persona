const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
querystring = require('querystring'),
primary = require('../browserid/primary.js'),
http = require('http'),
https = require('https');

exports.method = 'post';
exports.writes_db = false;
exports.authed = false;
exports.args = ['assertion'];

exports.process = function(req, res) {
  // this WSAPI will be invoked when a user attempts to authenticate with
  // an assertion from a primary identity authority.  It might seemlessly
  // create a user account if that's needed

  // 1. first let's verify that the assertion is valid
  primary.verifyAssertion(req.body.assertion, function(err, email) {
    if (err) {
      return res.json({
        success: false,
        reason: err.toString()
      });
    }

    // 2. if valid, does the user exist?
    db.emailType(email, function(type) {
      // if this is a known primary email, authenticate the user and we're done!
      if (type === 'primary') {
        wsapi.setAuthenticatedUser(req.session, email);
        return res.json({ success: true });
      }
      else if (type === 'secondary') {
        logger.error('user logs in with a primary address that was once a secondary, not implemented ('
                     + email + ')');
        return res.json({ success: false });
      }

      // if the user doesn't exist, let's bounce off the dbwriter to have the
      // user + email created
      var u = wsapi.fowardWritesTo;

      var m = u.scheme === 'http' ? http : https;

      var post_body = querystring.stringify({
        assertion: req.body.assertion,
        csrf: req.body.csrf
      });

      var preq = m.request({
        host: u.host,
        port: u.port,
        path: '/wsapi/create_account_with_assertion',
        method: "POST",
        headers: {
          'Cookie': req.headers['cookie'],
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': post_body.length
        }
      }, function(pres) {
        pres.on('end', function() {
          if (pres.statusCode !== 200) {
            logger.error("failed to create primary user with assertion for " + email + " (" + pres.statusCode + ")");
            res.json({ success: false, reason: "internal error creating account" });
          } else {
            logger.info("successfull created primary acct for " + email);
            wsapi.setAuthenticatedUser(req.session, email);
            res.json({ success: true });
          }
        });
      }).on('error', function(e) {
        logger.error("failed to create primary user with assertion for " + email + ": " + e);
        res.json({ success: false, reason: "internal error forwarding request" });
      });

      preq.write(post_body);
      preq.end();
    });
  });
};
