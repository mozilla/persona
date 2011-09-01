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

/* this file is the "reauth" activity, which simulates the process of a user
 * who has used browserid before signing into browserid inside the dialog and
 * picking an identity */

const
wcli = require("../../libs/wsapi_client.js"),
userdb = require("./user_db.js"),
winston = require('winston');

function syncEmails(cfg, context, cb) {

  function keyRefresh(email, cb) {
    var keypair = userdb.addKeyToUserCtx(context, email);
    wcli.post(cfg, '/wsapi/set_key', context, {
      email: email,
      pubkey: keypair.pub
    }, function (r) {
      cb(r.code === 200 && r.body === 'true');
    });
  }

  var emails = {};
  Object.keys(context.keys).forEach(function(e) { emails[e] = context.keys[e].pub });
  wcli.post(
    cfg, '/wsapi/sync_emails', context,
    { emails: JSON.stringify(emails) },
    function(r) {
      if (r.code != 200) {
        winston.error('failed to sync emails');
        return cb(false);
      }
      // now let's sync these emails!
      var sr = JSON.parse(r.body); 

      // first delete emails we know about that the server doesn't
      for (var i = 0; i < sr.unknown_emails; i++) {
        delete context.keys[sr.unknown_emails[i]];
      }

      // now refresh the keys for each email mentioned
      var complete = 0;
      var success = true;
      for (var i = 0; i < sr.key_refresh.length; i++) {
        keyRefresh(sr.key_refresh[i], function(r) {
          sucess = r && success;
          if (++complete >= sr.key_refresh.length) {
            cb(success);
          }
        });
      }
      if (sr.key_refresh.length === 0) cb(true);
    });
}

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
    return cb(false);
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

  wcli.post(
    cfg, '/wsapi/authenticate_user', context,
    { email: email, pass: user.password },
    function(r) {
      if (r.code != 200 || r.body !== "true") {
        winston.error('authentication failure: ' + r.code + "/" + r.body);
        return cb(false);
      }
      syncEmails(cfg, context, cb);
    });
};
