/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* this file is the "signin" activity, which simulates the process of a user
 * with an existing browserid account and existing authentication material
 * signin into a site. */

const
wcli = require("../../wsapi_client.js"),
userdb = require("../user_db.js"),
winston = require('winston'),
crypto = require('../crypto'),
common = require('../common');

exports.startFunc = function(cfg, cb) {

  // sign in when authentication material exists.
  //
  // 1. session context called
  // 2. list_emails called (always at dialog load time)
  // 3. assertion generated on the client
  // 4. /verify called to verify the assertion

  var user = userdb.getExistingUser();

  if (!user) {
    winston.warn("can't achieve desired concurrency!  not enough users!");
    return cb("not enough users");
  }

  // unlock the user when we're done with them
  cb = (function() {
    var _cb = cb;
    return function(x) {
      userdb.releaseUser(user);
      _cb(x);
    };
  })();

  // pick one of the user's emails that we'll use
  var email = userdb.any(user.emails);

  // pick one of the user's devices that we'll use
  var context = userdb.any(user.ctxs);

  var origin = userdb.any(user.sites);

  // establish session context and authenticate if needed
  common.authAndKey(cfg, user, context, email, function(err) {
    if (err) return cb(err);
    common.genAssertionAndVerify(cfg, user, context, email, origin, function(err) {
      cb(err);
    });
  });
};
