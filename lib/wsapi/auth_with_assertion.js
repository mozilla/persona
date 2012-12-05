/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
querystring = require('querystring'),
primary = require('../primary.js'),
http = require('http'),
https = require('https'),
config = require('../configuration');

exports.method = 'post';
exports.writes_db = false;
exports.authed = false;
exports.args = {
  'assertion': 'assertion',
  'ephemeral': 'boolean'
};
exports.i18n = false;

exports.process = function(req, res) {
  // this WSAPI will be invoked when a user attempts to authenticate with
  // an assertion from a primary identity authority.  It might seemlessly
  // create a user account if that's needed

  // 1. first let's verify that the assertion is valid
  primary.verifyAssertion(req.params.assertion, function(err, email) {
    if (err) {
      return res.json({
        success: false,
        reason: err.toString()
      });
    }

    // 2. if valid, does the user exist?
    db.emailType(email, function(err, type) {
      if (err) return wsapi.databaseDown(res, err);

      // if this is a known email adddess, authenticate the user and we're done.
      if (type) {
        db.emailToUID(email, function(err, uid) {
          if (err) return wsapi.databaseDown(res, err);
          if (!uid) return res.json({ success: false, reason: "internal error" });
          wsapi.authenticateSession(
            {
              session: req.session, uid: uid,
              level: 'assertion',
              duration_ms: req.params.ephemeral ?
                config.get('ephemeral_session_duration_ms')
                : config.get('authentication_duration_ms')
            }, function(err) {
              if (err) return wsapi.databaseDown(res, err);

              res.json({ success: true, userid: uid });

              // if this email was last used as a secondary, update the database
              // to record this fact.  Do this AFTER we've sent a response to
              // not block the user.  If this update fails, the worst case
              // will be a user seeing language about transitioning from secondary
              // to primary twice.
              if (type === 'secondary') {
                wsapi.requestToDBWriter({
                  path: '/wsapi/user_used_email_as',
                  method: "POST",
                  headers: {
                    'Cookie': res._headers['set-cookie'],
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    email: email,
                    used_as: 'primary',
                    csrf: req.session.csrf
                  })
                }, function(err) {
                  if (err) logger.warn("couldn't update lastUsedAs: " + err);
                });
              }

              return;
            });
        });

        return;
      }

      // if the user doesn't exist, let's bounce off the dbwriter to have the
      // user + email created
      wsapi.requestToDBWriter({
        path: '/wsapi/create_account_with_assertion',
        method: "POST",
        headers: {
          'Cookie': req.headers.cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assertion: req.params.assertion,
          csrf: req.params.csrf
        })
      }, function(err, r) {
        try {
          if (err) throw err;
          r = r.body;
          if (!r.success) throw "non-success response from dbwriter";
          if (!r.userid) throw "malformed response from dbwriter";
        } catch(e) {
          logger.error("failed to create primary user with assertion for " + email + ": " + e);
          return res.json({ success: false, reason: "internal error creating account" });
        }

        logger.info("successfully created primary acct for " + email + " (" + r.userid + ")");
        wsapi.authenticateSession(
          {
            session: req.session,
            uid: r.userid,
            level: 'assertion',
            duration_ms: req.params.ephemeral ?
              config.get('ephemeral_session_duration_ms')
              : config.get('authentication_duration_ms')
          }, function (err) {
            if (err) return wsapi.databaseDown(res, err);
            res.json({ success: true, userid: r.userid });
          });
      });
    });
  });
};
