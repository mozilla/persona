/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Lloyd Hilaiel <lloyd@hilaiel.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
    site: userdb.any(user.sites)
  }, function (r) {
    if (!r || r.code !== 200) return cb(false);
    // now get the verification secret
    wcli.get(cfg, '/wsapi/fake_verification', context, {
      email: email
    }, function (r) {
      if (!r || r.code !== 200) return cb(false);
      // and simulate clickthrough
      wcli.post(cfg, '/wsapi/complete_user_creation', context, {
        token: r.body,
        pass: user.password
      }, function (r) {
        if (r && r.code === 503) {
          return cb("server is too busy");
        } else if (!r || r.code !== 200) {
          return cb("failed to complete user creation");
        }
        try {
          if (JSON.parse(r.body).success !== true) throw "failed";
        } catch(e) {
          return cb("failed to complete user creation (body doesn't have .success === true)");
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
