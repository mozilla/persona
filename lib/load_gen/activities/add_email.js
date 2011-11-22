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

/* this file is the "add_email" activity, which simulates the process of a
 * user with an active session adding a new email with browserid. */

const
wcli = require("../../wsapi_client.js"),
userdb = require("../user_db.js"),
winston = require('winston'),
prepare = require('../prepare.js');

exports.startFunc = function(cfg, cb) {
  // 1. RP includes include.js
  // 2. session_context is called
  // 3. list_emails is called
  // 4. stage_email is called
  // 5. email_addition_status is invoked some number of times while the dialog polls
  // 6. landing page is loaded:
  //   6a. session_context
  //   6b. complete_email_addition
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
      userdb.releaseUser(user);
      _cb(x);
    };
  })();

  // pick one of the user's devices that we'll use
  var context = userdb.any(user.ctxs);

  // pick one of the user's emails that we'll use
  var email = userdb.addEmailToUser(user);

  var origin = userdb.any(user.sites);

  prepare.auth(cfg, user, context, user.emails[0], function(err) {
    if (err) return cb(err);
    // stage them
    wcli.post(cfg, '/wsapi/stage_email', context, {
      email: email,
      site: userdb.any(user.sites)
    }, function (r) {
      if (r.code !== 200) {
        var msg = 'failed to add email: ' + email + ' to existing user ' +
          user.emails[0];
        winston.error(msg);
        return cb(msg);
      }
      // now get the verification secret
      wcli.get(cfg, '/wsapi/fake_verification', context, {
        email: email
      }, function (r) {
        if (r.code !== 200) {
          var err ='failed to fetch verification token for email: ' + email;
          winston.error(err);
          return cb(err);
        }
        var token = r.body;

        // and simulate clickthrough
        wcli.post(cfg, '/wsapi/complete_email_addition', context, {
          token: token
        }, function (r) {
          try {
            if (r.code !== 200) throw "bad response code";
            if (JSON.parse(r.body).success !== true) throw "success?  no.";
          } catch (e) {
            var err = 'failed to complete email addition for: ' + email + ' (' + token + '): ' + e.toString();
            winston.error(err);
            process.exit(1);
            return cb(err);
          }

          // and now we should call registration status to complete the
          // process
          wcli.get(cfg, '/wsapi/email_addition_status', context, {
            email: email
          }, function(r) {
            try {
              if (r.code !== 200) throw "bad response code";
              if (JSON.parse(r.body).status !== 'complete') throw "addition not complete?  wrong: " + r.body;
            } catch(e) {
              var err = "registration_status failed during signup: " + e.toString();
              winston.error(err);
              return cb(err);
            }

            // now generate a key
            prepare.authAndKey(cfg, user, context, email, function(err) {
              if (err) return cb(err);
              prepare.genAssertionAndVerify(cfg, user, context, email, origin, function(err) {
                cb(err);
              });
            });
          });
        });
      });
    });
  });
};
