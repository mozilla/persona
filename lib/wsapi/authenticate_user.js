/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
bcrypt = require('../bcrypt'),
http = require('http'),
https = require('https'),
querystring = require('querystring'),
statsd = require('../statsd'),
config = require('../configuration'),
cef_logger = require('../cef_logger').getInstance(),
wsapiutils = require('../wsapiutils');

exports.method = 'post';
exports.writes_db = false;
exports.authed = false;
exports.i18n = false;
exports.args = {
  'email': 'email',
  'pass':  'password',
  'ephemeral': 'boolean',
  'allowUnverified': {
    type: 'boolean',
    required: false
  }
};

exports.process = function(req, res) {
  function fail(reason, code) {
    var r = { success: false };
    if (code) r.code = code;
    if (reason) r.reason = reason;
    cef_logger.warn("AUTH_FAILURE", "User authentication failed", req, {msg:reason});
    logger.debug('authentication fails for user: ' + req.params.email + (reason ? (' - ' + reason) : ""));
    return res.json(r);
  }

  db.emailToUID(req.params.email, function(err, uid) {
    if (err) return wsapi.databaseDown(res, err);

    if (typeof uid !== 'number') {
      return fail('no such user');
    }

    function compare(hash, failedAuthTries) {
      logger.debug("hash is " + hash);
      if (err) return wsapi.databaseDown(res, err);

      if (typeof hash !== 'string') {
        return fail('no password set for user');
      }

      var startTime = new Date();
      bcrypt.compare(req.params.pass, hash, function (err, success) {
        var reqTime = new Date() - startTime;
        statsd.timing('bcrypt.compare_time', reqTime);

        if (err) {
          if (err.indexOf('exceeded') !== -1) {
            cef_logger.alert("LOAD_HIGH", "Load exceeded on auth request", req);
            logger.warn("max load hit, failing on auth request with 503: " + err);
            res.status(503);
            return fail("server is too busy");
          }
          cef_logger.alert("BCRYPT_ERROR", "Internal error on bcrypt.compare", req, {msg: err});
          logger.error("error comparing passwords with bcrypt: " + err);
          return fail("internal password check error");
        } else if (!success) {
          cef_logger.warn("AUTH_FAILURE", "Password mismatch", req);
          incrementAuthCount(req, res, uid);
          return fail("password mismatch for user: " + req.params.email);
        } else {
          if (!req.session) req.session = {};

          var durationInfo = wsapiutils.getDurationInfo(req);
          wsapi.authenticateSession({session: req.session, uid: uid,
                                     level: 'password',
                                     duration_ms: durationInfo.durationMS
                                    }, function(err) {
                                      if (err)
                                        return wsapi.databaseDown(res, err);
                                      res.json({
                                        success: true,
                                        userid: uid,
                                        suppress_ask_if_users_computer:
                                            durationInfo.suppressAskIsUsersComputer
                                      });

                                      // if the work factor has changed, update the hash here.  issue #204
                                      // NOTE: this runs asynchronously and will not delay the response
                                      if (config.get('bcrypt_work_factor') !== bcrypt.getRounds(hash)) {
                                        updateHash(req, res, uid, hash);
                                      }
                                      // if the user previously had failed authentication attempts, let's
                                      // reset the count to zero once they do successfully authenticate.
                                      if (failedAuthTries !== 0) {
                                        resetFailedAuthCount(req, res, uid);
                                      }
                                    });
        }
      });
    }

    db.checkAuth(uid, function(err, hash, failedAuthTries) {
      if (err) return wsapi.databaseDown(res, err);

      logger.debug("checkAuth = hash = " + hash);
      if (failedAuthTries >= config.get('max_authentication_attempts')) {
        fail('account is locked', 'account locked');
      } else if (typeof hash !== 'string') {
        return fail('no password set for user');
      } else {
        compare(hash);
      }
    });
  });
};


function incrementAuthCount(req, res, uid) {
  var u = wsapi.forwardWritesTo;
  var m = u.scheme === 'http' ? http : https;
  var preq = m.request({
    host: u.host,
    port: u.port,
    path: '/wsapi/increment_failed_auth_tries?' + querystring.stringify({userid: uid}),
    method: "GET",
    rejectUnauthorized: true,
    agent: false
  }, function(pres) {
    pres.on('end', function() {
      if (pres.statusCode !== 200) {
        cef_logger.alert("DB_FAILURE", "Cannot increment failed authentication attempts",
                         req, {suser: uid, msg: pres.statusCode});
        logger.error("failed to increment failed authentication attempts for " + uid +
                     " dbwriter returns " + pres.statusCode);
      } else {
        logger.info("incremented authentication failure count for user " + uid);
      }
    });
  }).on('error', function(e) {
    cef_logger.alert("AUTH_FAILURE", "Cannot increment failed authentication attempts",
                     req, {suser: uid, msg: e});
    logger.error("cannot increment failed authentication attempts for " + uid + ": " + e);
  });
  preq.end();
}

function resetFailedAuthCount(req, res, uid) {
  var u = wsapi.forwardWritesTo;
  var m = u.scheme === 'http' ? http : https;
  var preq = m.request({
    host: u.host,
    port: u.port,
    path: '/wsapi/reset_failed_auth_tries',
    method: "GET",
    rejectUnauthorized: true,
    agent: false,
    headers: {
      'Cookie': res._headers['set-cookie']
    }
  }, function(pres) {
    pres.on('end', function() {
      if (pres.statusCode !== 200) {
        cef_logger.alert("DB_FAILURE", "Cannot clear failed authentication attempts",
                         req, {suser: uid, msg: pres.statusCode});
        logger.error("failed to clear authentication attempts for " + uid +
                     " dbwriter returns " + pres.statusCode);
      } else {
        logger.info("cleared authentication failure count for user " + uid);
      }
    });
  }).on('error', function(e) {
    cef_logger.alert("AUTH_FAILURE", "Cannot clear failed authentication attempts",
                     req, {suser: uid, msg: e});
    logger.error("failed to clear authentication attempts for " + uid + ": " + e);
  });
  preq.end();
}

function updateHash(req, res, uid, hash) {
  cef_logger.warn("AUTH_UPDATE", "Updated password for user", req, {suser:uid});
  logger.info("updating bcrypted password for user " + uid);

  // this request must be forwarded to dbwriter, and we'll use the
  // authentication cookie of the user just sent out.
  var u = wsapi.forwardWritesTo;

  var m = u.scheme === 'http' ? http : https;

  var post_body = querystring.stringify({
    oldpass: req.params.pass,
    newpass: req.params.pass,
    csrf: req.params.csrf
  });
  var preq = m.request({
    host: u.host,
    port: u.port,
    path: '/wsapi/update_password',
    method: "POST",
    rejectUnauthorized: true,
    agent: false,
    headers: {
      'Cookie': res._headers['set-cookie'],
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': post_body.length
    }
  }, function(pres) {
    pres.on('end', function() {
      if (pres.statusCode !== 200) {
        cef_logger.alert("DB_FAILURE", "Cannot update password rounds; dbwriter error",
                                  req, {suser: uid, msg: pres.statusCode});
        logger.error("failed to update bcrypt rounds of password for " + uid +
                     " dbwriter returns " + pres.statusCode);
      } else {
        logger.info("bcrypt rounds of password for " + uid +
                    " successfully updated (from " +
                    bcrypt.getRounds(hash) + " to "
                    + config.get('bcrypt_work_factor') + ")");
      }
    });
  }).on('error', function(e) {
    cef_logger.alert("AUTH_FAILURE", "Error updating password rounds",
                              req, {suser: uid, msg: e});
    logger.error("failed to update bcrypt rounds of password for " + uid + ": " + e);
  });

  preq.write(post_body);
  preq.end();
}
