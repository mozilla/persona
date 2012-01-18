const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
bcrypt = require('../bcrypt'),
http = require('http'),
https = require('https'),
querystring = require('querystring'),
statsd = require('../statsd');

exports.method = 'post';
exports.writes_db = false;
exports.authed = false;
exports.args = ['email','pass'];

exports.process = function(req, res) {
  function fail(reason) {
    var r = { success: false };
    if (reason) r.reason = reason;
    logger.debug('authentication fails for user: ' + req.body.email + (reason ? (' - ' + reason) : ""));
    return res.json(r);
  }

  db.emailToUID(req.body.email, function(uid) {
    if (typeof uid !== 'number') {
      return fail('no such user');
    }

    db.checkAuth(uid, function(hash) {
      if (typeof hash !== 'string') {
        return fail('no password set for user');
      }

      var startTime = new Date();
      bcrypt.compare(req.body.pass, hash, function (err, success) {
        var reqTime = new Date - startTime;
        statsd.timing('bcrypt.compare_time', reqTime);

        if (err) {
          if (err.indexOf('exceeded') != -1) {
            logger.warn("max load hit, failing on auth request with 503: " + err);
            res.status(503);
            return fail("server is too busy");
          }
          logger.error("error comparing passwords with bcrypt: " + err);
          return fail("internal password check error");
        } else if (!success) {
          return fail("password mismatch for user: " + req.body.email);
        } else {
          if (!req.session) req.session = {};

          wsapi.setAuthenticatedUser(req.session, uid);
          res.json({ success: true });


          // if the work factor has changed, update the hash here.  issue #204
          // NOTE: this runs asynchronously and will not delay the response
          if (config.get('bcrypt_work_factor') != bcrypt.get_rounds(hash)) {
            logger.info("updating bcrypted password for user " + uid);

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
                'Cookie': res._headers['set-cookie'],
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': post_body.length
              }
            }, function(pres) {
              pres.on('end', function() {
                if (pres.statusCode !== 200) {
                  logger.error("failed to update bcrypt rounds of password for " + uid +
                               " dbwriter returns " + pres.statusCode);
                } else {
                  logger.info("bcrypt rounds of password for " + uid +
                              " successfully updated (from " +
                              bcrypt.get_rounds(hash) + " to "
                              + config.get('bcrypt_work_factor') + ")");
                }
              });
            }).on('error', function(e) {
              logger.error("failed to update bcrypt rounds of password for " + uid + ": " + e);
            });

            preq.write(post_body);
            preq.end();
          }
        }
      });
    });
  });
};
