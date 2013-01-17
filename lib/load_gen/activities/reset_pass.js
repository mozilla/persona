/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* this file is the "reset_pass" activity, which simulates the process of a
 * user resetting their password. */

const
wcli = require("../../wsapi_client.js"),
userdb = require("../user_db.js"),
winston = require('winston'),
common = require('../common');

exports.startFunc = function(cfg, cb) {

  var origUser = userdb.getExistingUser();

  if (!origUser) {
    winston.warn("can't achieve desired concurrency!  not enough users!");
    return cb("not enough users");
  }

  var user = origUser;

  var newUser;
  if (user.emails.length > 1) {
    user = newUser = userdb.splitUser(user);
  }

  // unlock the user when we're done with them
  cb = (function() {
    var _cb = cb;
    return function(x) {
      // if the request is successful, and we split off a new user,
      // then lets add them to the database
      if (!x && newUser) userdb.addNewUser(newUser);
      userdb.releaseUser(origUser);
      _cb(x);
    };
  })();

  // if we did not split a user, we are going to change the user's uid
  // out from under them.  this means we should clear all authenticated
  // sessions, lest they remain authenticated as the old uid.
  if (!newUser) userdb.clearContexts(user);

  // now everything is identical to the signup flow
  // pick a device context at random
  var context = userdb.any(user.ctxs);

  // pick an email address to operate on (there should really be
  // only one at this point)
  var email = userdb.any(user.emails);

  var origin = userdb.any(user.sites);

  // staging a user will log you out!  let's clear the authenticated bit
  if (context && context.session && context.session.authenticated) {
    context.session.authenticated = false;
  }

  // stage them
  wcli.post(cfg, '/wsapi/stage_user', context, {
    email: email,
    pass: user.password,
    site: userdb.any(user.sites)
  }, function (err, r) {
    err = common.checkResponse(err, r);
    if (err) return cb(err);

    // now get the verification secret
    wcli.get(cfg, '/wsapi/fake_verification', context, {
      email: email
    }, function (err, r) {
      err = common.checkResponse(err, r);
      if (err && err.code !== 'nonJSON') return cb(err);

      // and simulate clickthrough
      wcli.post(cfg, '/wsapi/complete_user_creation', context, {
        token: r.body
      }, function (err, r) {
        err = common.checkResponse(err, r);
        if (err) return cb(err);
        if (r.body.success !== true) {
          return cb(common.error("failed to complete user creation"));
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
