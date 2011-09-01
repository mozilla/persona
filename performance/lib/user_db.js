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

/* the "user database".  a little in-memory collection of users for the
 * purposes of performance testing. 
 */

var secrets = require('../../libs/secrets.js');

// the grandiose database
var users = [ ];

exports.num = function() { return users.length; }

function genEmail() {
  return secrets.generate(8) + "@" + secrets.generate(8) + "." + secrets.generate(3);
}

// a little utilitiy function to get any one of an array of items
exports.any = function (a) {
  if (!Array.isArray(a)) throw "any may only be called on arrays";
  return a[Math.floor(Math.random() * a.length)];
}

exports.getNewUser = function() {
  // create and return a new user record
  var user = {
    // all users are "locked" upon creation to keep simultaneous
    // and conflicting activities from being performed on the
    // same user
    locked: true,
    // all users start with a single email address
    emails: [ genEmail() ],
    // a password of 10 chars
    password: secrets.generate(10),
    // and four sites that they visit
    sites: [
      secrets.generate(8) + "." + secrets.generate(3),
      secrets.generate(8) + "." + secrets.generate(3),
      secrets.generate(8) + "." + secrets.generate(3),
      secrets.generate(8) + "." + secrets.generate(3)
    ],
    // and their device contexts (they have 2 devices on average)
    // key material is device specific
    ctxs: [
      {
        // and no public keys (XXX: beware the cometh of certs)
        keys: {
        }
      },
      {
        keys: {
        }
      }
    ]
  };
  numLockedUsers++;
  users.push(user);
  return user;
};

var numLockedUsers = 0;

exports.getExistingUser = function() {
  if (!users.length) throw "can't get an existing user. there aren't any.  call getNewUser first.";
  if (users.length === numLockedUsers) {
    console.log("all users are locked!");
    return undefined;
  }
  while (true) {
    var u = exports.any(users);
    if (!u.locked) {
      u.locked = true;
      numLockedUsers++;
      return u;
    }
  }
};

exports.releaseUser = function(user) {
  if (!user.locked) throw "you can't release a user that's not in use!";
  delete user.locked;
  numLockedUsers--;
};

exports.addEmailToUser = function(user) {
  var email = genEmail();
  user.emails.push(email);
  return email;
};

exports.addKeyToUserCtx = function(ctx, email) {
  // this is simulated.  it will need to be real to apply load to
  // the verifier, but that in turn will drastically increase the
  // cost of the application of load.  ho hum.
  var pub = secrets.generate(128);
  var priv = secrets.generate(128);
  var k = {pub: pub, priv: priv}
  ctx.keys[email] = k;
  return k;
}