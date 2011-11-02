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

const
wcli = require("../../libs/wsapi_client.js"),
userdb = require("./user_db.js"),
winston = require('winston');

/* this file is the "signup" activity, which simulates the process of a new user
 * signing up for browserid. */
exports.startFunc = function(cfg, cb) {

  // A new user signing up for browserid looks like this in terms of
  // network transactions:
  //
  // 1. RP includes include.js 
  // 2. users' browser loads all code associated with dialog
  // 3. in page javascript calls CSRF to get a CSRF token
  // 4. /wsapi/have_email is called some number of times to give feedback as the
  //    user types in their email address
  // 5. /wsapi/stage_user is called to stage the user for creation when the
  //    user clicks "continue" after having chosen a password
  // 6. /wsapi/registration_status is called once for each second it takes the
  //    user to go to their email and click on the verification link
  // 6.5. in the load testing environment, we make a call to the server to get
  //    the email verification token
  // 7. /prove is called on the server, passing in the authentication token
  // 8. /manage is called on the server as the user's page transitions from
  //    the verify screen to the manage screen.
  // 9. /wsapi/sync_emails is called from the client (XXX: this is probably a bug,
  //    there's no utility to this)
  // 10. /wsapi/set_key is called from the client to inform the server of the
  //    user's public key (XXX: this will go away when we migrate to certificates
  //    and instead, the server will be asked to sign the user's public key.)
  // 11.  the RP will call /verify to verify a generated assertion

  // XXX: for now this is *api only*,  that is we omit steps above that would just be
  // the serving of static pages.  it is unknown to me whether static page simulation
  // is useful.

  // get a user
  var user = userdb.getNewUser();

  if (!user) {
    winston.warn("can't achieve desired concurrency!  not enough users!");
    return cb(false);
  }

  // unlock the user when we're done with them
  cb = (function() {
    var _cb = cb;
    return function(x) {
      userdb.releaseUser(user);
      _cb(x);
    };
  })();

  // pick a device context at random
  var context = userdb.any(user.ctxs);

  // pick an email address to operate on (there should really be
  // only one at this point
  var email = userdb.any(user.emails);

  // add a key for the specified email to their device context 
  var keypair = userdb.addKeyToUserCtx(context, email);

  // stage them
  wcli.post(cfg, '/wsapi/stage_user', context, {
    email: email,
    pass: user.password,
    pubkey: keypair.pub,
    site: userdb.any(user.sites)
  }, function (r) {
    if (r.code !== 200) return cb(false);
    // now get the verification secret
    wcli.get(cfg, '/wsapi/fake_verification', context, {
      email: email
    }, function (r) {
      if (r.code !== 200) return cb(false);
      // and simulate clickthrough
      wcli.get(cfg, '/wsapi/prove_email_ownership', context, {
        token: r.body
      }, function (r) {
        if (r.code !== 200 || r.body !== 'true') return cb(false);
        // and now we should call registration status to complete the
        // process
        wcli.get(cfg, '/wsapi/registration_status', context, {
        }, function(r) {
          var rv = (r.code === 200 && r.body === '"complete"');
          if (!rv) winston.error("registration_status failed during signup: " + JSON.stringify(r));
          cb(rv);
        });
      });
    });
  });
};
