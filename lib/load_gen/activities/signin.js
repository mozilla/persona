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

/* this file is the "signin" activity, which simulates the process of a user
 * with an existing browserid account and existing authentication material
 * signin into a site. */

const
wcli = require("../../wsapi_client.js"),
userdb = require("../user_db.js"),
winston = require('winston'),
crypto = require('../crypto'),
prepare = require('../prepare');

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

  // pick one of the user's emails that we'll use
  var email = userdb.any(user.emails);

  // pick one of the user's devices that we'll use
  var context = userdb.any(user.ctxs);

  var origin = userdb.any(user.sites);

  // establish session context and authenticate if needed
  prepare(cfg, user, context, email, function(err) {
    try {
      serverTime = new Date(context.session.server_time);
      wcli.get(cfg, '/wsapi/list_emails', context, undefined, function (r) {
        // just verify that we got a JSON object, we don't care about
        // the contents so much
        try {
          if (!typeof JSON.parse(r.body) === 'object') throw 'bogus response';
        } catch(e) {
          return cb(false);
        }

        var assertion = crypto.getAssertion({
          now: serverTime,
          secretKey: context.keys[email].keyPair.secretKey,
          cert: context.keys[email].cert,
          audience: origin,
          email: email
        });

        wcli.post(cfg, '/verify', {}, {
          audience: origin,
          assertion: assertion
        }, function (r) {
          try {
            cb(JSON.parse(r.body).status === 'okay' ? undefined : "verification failed");
          } catch(e) {
            return cb(e.toString);
          }
        });
      });
    } catch(e) {
      cb(e.toString());
    }
  });
};
