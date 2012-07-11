/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* this file is the "add_email" activity, which simulates the process of a
 * user with an active session adding a new email with browserid. */

const
wcli = require("../../wsapi_client.js"),
userdb = require("../user_db.js"),
winston = require('winston'),
common = require('../common.js');

exports.startFunc = function(cfg, cb) {
  // 1. RP includes include.js
  // 2. session_context is called
  // 3. list_emails is called
  // 4. stage_email is called
  // 5. email_addition_status is invoked some number of times while the dialog polls
  // 6. landing page is loaded:
  //   6a. session_context
  //   6b. complete_email_confirmation
  // 7. email_addition_status returns 'complete'
  // 8. a key is generated and added

  // first let's get an existing user
  var user = userdb.getExistingUser();

  if (!user) {
    winston.warn("can't achieve desired concurrency!  not enough users!");
    return cb("not enough users");
  }

  // user will be "released" once we're done with her.
  cb = (function() {
    var _cb = cb;
    return function(x) {
      if (x) userdb.removeLastEmailFromUser(user);
      userdb.releaseUser(user);
      _cb(x);
    };
  })();

  // pick one of the user's devices that we'll use
  var context = userdb.any(user.ctxs);

  // pick one of the user's emails that we'll use
  var email = userdb.addEmailToUser(user);

  var origin = userdb.any(user.sites);

  common.auth(cfg, user, context, user.emails[0], function(err) {
    if (err) return cb(err);
    // stage them
    wcli.post(cfg, '/wsapi/stage_email', context, {
      email: email,
      site: userdb.any(user.sites)
    }, function (err, r) {
      if (err) return cb(err);
      if (!r || r.code !== 200) {
        var msg = 'failed to add email: ' + email + ' to existing user ' +
          user.emails[0];
        winston.error(msg);
        return cb(msg);
      }
      // now get the verification secret
      wcli.get(cfg, '/wsapi/fake_verification', context, {
        email: email
      }, function (err, r) {
        if (err) return cb(err);
        if (!r || r.code !== 200) {
          var err ='failed to fetch verification token for email: ' + email;
          winston.error(err);
          return cb(err);
        }
        var token = r.body;

        // and simulate clickthrough
        wcli.post(cfg, '/wsapi/complete_email_confirmation', context, {
          token: token
        }, function (err, r) {
          try {
            if (err) throw err;
            if (r.code !== 200) throw "bad response code";
            if (JSON.parse(r.body).success !== true) throw "success?  no.";
          } catch (e) {
            var err = 'failed to complete email addition for: ' + email + ' (' + token + '): ' + e.toString();
            winston.error(err);
            return cb(err);
          }

          // and now we should call registration status to complete the
          // process
          wcli.get(cfg, '/wsapi/email_addition_status', context, {
            email: email
          }, function(err, r) {
            try {
              if (err) throw err;
              if (r.code !== 200) throw "bad response code";
              if (JSON.parse(r.body).status !== 'complete') throw "addition not complete?  wrong: " + r.body;
            } catch(e) {
              var err = "registration_status failed during signup: " + e.toString();
              winston.error(err);
              return cb(err);
            }

            // now generate a key
            common.authAndKey(cfg, user, context, email, function(err) {
              if (err) return cb(err);
              common.genAssertionAndVerify(cfg, user, context, email, origin, function(err) {
                cb(err);
              });
            });
          });
        });
      });
    });
  });
};
