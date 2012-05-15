/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
wcli = require("../../wsapi_client.js"),
userdb = require("../user_db.js"),
winston = require('winston'),
common = require('../common');

/* this file is the "signup" activity, which simulates the process of a new user
 * signing up for browserid. */
exports.startFunc = function(cfg, cb) {

  // A new user signing up for browserid looks like this in terms of
  // network transactions:
  //
  // 1. RP includes include.js
  // 2. users' browser loads all code associated with dialog
  // 3. in page javascript calls /wsapi/session_context to get a CSRF token
  // 4. /wsapi/have_email is called some number of times to give feedback as the
  //    user types in their email address
  // 5. /wsapi/stage_user is called to stage the user for creation when the
  //    user clicks "continue" after having chosen a password
  // 6. /wsapi/user_creation_status is called once for each second it takes the
  //    user to go to their email and click on the verification link
  // 6.5. in the load testing environment, we make a call to the server to get
  //    the email verification token
  // 7. /wsapi/email_for_token is called (by the landing page)
  // 8. /wsapi/session_context is called again (by the landing page)
  // 9. /wsapi/complete_user_creation is called (by the landing page)
  // 10. /wsapi/cert_key is called by the dialog
  // 11. /verify is invoked

  // get a user
  var user = userdb.getNewUser();

  if (!user) {
    winston.error(".getNewUser() should *never* return undefined!");
    process.exit(1);
  }

  // unlock the user when we're done with them
  cb = (function() {
    var _cb = cb;
    return function(x) {
      if (!x) userdb.addNewUser(user);
      _cb(x);
    };
  })();

  // pick a device context at random
  var context = userdb.any(user.ctxs);

  // pick an email address to operate on (there should really be
  // only one at this point
  var email = userdb.any(user.emails);

  var origin = userdb.any(user.sites);

  // stage them
  wcli.post(cfg, '/wsapi/stage_user', context, {
    email: email,
    site: userdb.any(user.sites),
    pass: user.password
  }, function (err, r) {
    if (err) return cb(err);
    if (r.code !== 200) return cb("can't stage user, non-200 response: " + r.code);
    // now get the verification secret
    wcli.get(cfg, '/wsapi/fake_verification', context, {
      email: email
    }, function (err, r) {
      if (err) return cb(err);
      if (r.code !== 200) return cb("can't get verification secret: " + r.code);
      // and simulate clickthrough
      wcli.post(cfg, '/wsapi/complete_user_creation', context, {
        token: r.body,
        ephemeral: false
      }, function (err, r) {
        try {
          if (err) throw err;
          r.body = JSON.parse(r.body);
          if (r.code !== 200 || r.body.success !== true) {
            throw "non-success" + (r.body && r.body.reason ? " (" + r.body.reason + ")" : "");
          }
        } catch(e) {
          return cb("failed to complete user creation: " + e);
        }
        // and now let's log in with this email address
        common.authAndKey(cfg, user, context, email, function(err) {
          if (err) return cb(err);
          common.genAssertionAndVerify(cfg, user, context, email, origin, function(err) {
            cb(err);
          });
        });
      });
    });
  });
};
