/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* this file is the "reauth" activity, which simulates the process of a user
 * who has used browserid before signing into browserid inside the dialog and
 * picking an identity */

const
common = require("../common.js"),
userdb = require("../user_db.js"),
winston = require('winston'),
wcli = require('../../wsapi_client.js');

exports.startFunc = function(cfg, cb) {
  // 1. RP includes include.js
  // 2. users' browser loads all code associated with dialog
  // 3. in page javascript calls CSRF to get a CSRF token
  // 4. /wsapi/authenticate_user is called once the user enters credentials
  // 5. /wsapi/sync_emails is called from the client to get a list of all emails
  //    that are verified for the user
  // 6. /wsapi/set_key is called once per email from the client to inform the server
  //    of the user's public keys (XXX: this should be lazy and only do the email that
  //    the user is using, further this will change once we move to certificates)
  // 7. the RP will call /verify to verify a generated assertion

  // first let's get an existing user
  var user = userdb.getExistingUser();

  if (!user) {
    winston.warn("can't achieve desired concurrency!  not enough users!");
    return cb("concurrency error");
  }

  // user will be "released" once we're done with her.
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

  // clear cookies from this context (we're going to log in again)
  wcli.clearCookies(context);
  if (context.session && context.session.authenticated)
    context.session.authenticated = false;

  var origin = userdb.any(user.sites);

  // establish session context and authenticate if needed
  common.authAndKey(cfg, user, context, email, function(err) {
    if (err) return cb(err);
    common.genAssertionAndVerify(cfg, user, context, email, origin, function(err) {
      cb(err);
    });
  });
};
