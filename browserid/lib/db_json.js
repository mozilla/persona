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

/* db_json is a json database driver.  It is designed for use in
 * local development, is intended to be extremely easy to maintain,
 * have minimal dependencies on 3rd party libraries, and we could
 * care less if it performs well with more than 10 or so users.
 */
const
path = require('path'),
fs = require('fs'),
secrets = require('../../libs/secrets'),
jsel = require('JSONSelect'),
logger = require('../../libs/logging.js').logger,
configuration = require('../../libs/configuration.js'),
temp = require('temp');

// a little alias for stringify
const ESC = JSON.stringify;

var dbPath = path.join(configuration.get('var_path'), "authdb.json");

/* The JSON database. The structure is thus:
 *  [
 *    {
 *      password: "somepass",
 *      emails: [
 *        {
 *          address: "lloyd@hilaiel.com",
 *          keys: [
 *            {
 *              key: "SOMESTRINGOFTEXT",
 *              expires: 1231541615125
 *            }
 *          ]
 *        }
 *      ]
 *    }
 *  ]
 */

var db = [];
var stagedEmails = { };
var staged = { };

function flush() {
  try {
    var e = fs.writeFileSync(dbPath, JSON.stringify(db));
  } catch (e) {
    logger.error("Cannot save database to " + dbPath);
  }
}

// when should a key created right now expire?
function getExpiryTime() {
  return ((new Date()).getTime() + (14 * 24 * 60 * 60 * 1000));
}

// when unit_test is set in configuration, database should be
// ephemeral.  which simply means we use a temp file and delete
// on close;
var delete_on_close = false;

exports.open = function(cfg, cb) {
  delete_on_close = false;

  if (cfg) {
    if (cfg.unit_test) {
      dbPath = temp.path({suffix: '.db'});
      delete_on_close = true;
    } else if (cfg.path) {
      dbPath = cfg.path;
    }
  }

  try {
    db = JSON.parse(fs.readFileSync(dbPath));
  } catch(e) {
  }

  setTimeout(cb, 0);
};

exports.close = function(cb) {
  flush();
  setTimeout(cb, 0);
  if (delete_on_close) {
    delete_on_close = false;
    fs.unlink(dbPath, function(err) { });
  };
};

exports.emailKnown = function(email, cb) {
  var m = jsel.match(".address:val(" + ESC(email) + ")", db);
  setTimeout(function() { cb(m.length > 0) }, 0);
};

exports.isStaged = function(email, cb) {
  if (cb) {
    setTimeout(function() {
      cb(stagedEmails.hasOwnProperty(email));
    }, 0);
  }
};

exports.emailsBelongToSameAccount = function(lhs, rhs, cb) {
  emailToUserID(lhs, function(lhs_uid) {
    emailToUserID(rhs, function(rhs_uid) {
      cb(lhs_uid === rhs_uid);
    }, function (error) {
      cb(false);
    });
  }, function (error) {
    cb(false);
  });
};

function addEmailToAccount(existing_email, email, pubkey, cb) {
  emailToUserID(existing_email, function(userID) {
    if (userID == undefined) {
      cb("no such email: " + existing_email, undefined);
    } else {
      db[userID].emails.push({
        address: email,
        keys: [
          {
            key: pubkey,
            expires: getExpiryTime()
          }
        ]
      });
      flush();
      cb();
    }
  });
}

exports.addKeyToEmail = function(existing_email, email, pubkey, cb) {
  emailToUserID(existing_email, function(userID) {
    if (userID == undefined) {
      cb("no such email: " + existing_email, undefined);
      return;
    }

    if (!(db[userID].emails)) {
      db[userID].emails = [ ];
    }

    var m = jsel.match("object:has(.address:val(" + ESC(email) + ")) > .keys", db[userID].emails);
    
    if (jsel.match(".key:val(" + ESC(pubkey) + ")", m).length > 0) {
      return cb("cannot set a key that is already known");
    }

    var kobj = {
      key: pubkey,
      expires: getExpiryTime()
    };

    if (m.length) {
      m[0].push(kobj);
    } else {
      db[userID].emails.push({
        address: email,
        keys: [ kobj ]
      });
    }

    flush();
    if (cb) setTimeout(function() { cb(); }, 0);
  });
}

exports.stageUser = function(obj, cb) {
  var secret = secrets.generate(48);

  // overwrite previously staged users
  staged[secret] = {
    type: "add_account",
    email: obj.email,
    pubkey: obj.pubkey,
    pass: obj.hash
  };

  stagedEmails[obj.email] = secret;
  setTimeout(function() { cb(secret); }, 0);
};

exports.stageEmail = function(existing_email, new_email, pubkey, cb) {
  var secret = secrets.generate(48);
  // overwrite previously staged users
  staged[secret] = {
    type: "add_email",
    existing_email: existing_email,
    email: new_email,
    pubkey: pubkey
  };
  stagedEmails[new_email] = secret;
  setTimeout(function() { cb(secret); }, 0);
};

exports.gotVerificationSecret = function(secret, cb) {
  if (!staged.hasOwnProperty(secret)) return cb("unknown secret");

  // simply move from staged over to the emails "database"
  var o = staged[secret];
  delete staged[secret];
  delete stagedEmails[o.email];
  if (o.type === 'add_account') {
    exports.emailKnown(o.email, function(known) {
      function createAccount() {
        db.push({
          password: o.pass,
          emails: [
            {
              address: o.email,
              keys: [ {
                key: o.pubkey,
                expires: getExpiryTime(),
              } ]
            }
          ]
        });
        flush();
        cb();
      }

      // if this email address is known and a user has completed a re-verification of this email
      // address, remove the email from the old account that it was associated with, and then
      // create a brand new account with only this email.
      // NOTE: this might be sub-optimal, but it's a dead simple approach that mitigates many attacks
      // and gives us reasonable behavior (without explicitly supporting) in the face of shared email
      // addresses.

      if (known) {
        exports.removeEmail(o.email, o.email, function (err) {
          if (err) cb(err);
          else createAccount();
        });
      } else {
        createAccount();
      }
    });
  } else if (o.type === 'add_email') {
    exports.emailKnown(o.email, function(known) {
      function addIt() {
        addEmailToAccount(o.existing_email, o.email, o.pubkey, cb);
      }
      if (known) {
        exports.removeEmail(o.email, o.email, function (err) {
          if (err) cb(err);
          else addIt();
        });
      } else {
        addIt();
      }
    });
  } else {
    cb("internal error");
  }
};

exports.checkAuth = function(email, cb) {
  var m = jsel.match(":root > object:has(.address:val(" + ESC(email) + ")) > .password", db);
  if (m.length === 0) m = undefined;
  else m = m[0];
  setTimeout(function() { cb(m) }, 0);
};

function emailToUserID(email, cb) {
  var id = undefined;

  for (var i = 0; i < db.length; i++) {
    if (jsel.match(".address:val(" + JSON.stringify(email) + ")", db[i]).length) {
      id = i;
      break;
    }
    if (id !== undefined) break;
  }

  setTimeout(function() { cb(id); }, 0);
}

exports.getSyncResponse = function(email, identities, cb) {
  var respBody = {
    unknown_emails: [ ],
    key_refresh: [ ]
  };

  // get the user id associated with this account
  emailToUserID(email, function(userID) {
    if (userID === undefined) {
      cb("no such email: " + email);
      return;
    }
    var emails = jsel.match(".address", db[userID]);
    var keysToCheck = [ ];

    // #1 emails that the client knows about but we do not
    for (var e in identities) {
      if (emails.indexOf(e) == -1) respBody.unknown_emails.push(e);
      else keysToCheck.push(e);
    }

    // #2 emails that we know about and the client does not
    for (var e in emails) {
      e = emails[e];
      if (!identities.hasOwnProperty(e)) respBody.key_refresh.push(e);
    }

    // #3 emails that we both know about but who need to be re-keyed
    if (keysToCheck.length) {
      var checked = 0;
      keysToCheck.forEach(function(e) {
        if (!jsel.match(".key:val(" + ESC(identities[e]) + ")", db[userID]).length)
          respBody.key_refresh.push(e);
        checked++;
        if (checked === keysToCheck.length) cb(undefined, respBody);
      });
    } else {
      cb(undefined, respBody);
    }
  });
};

exports.pubkeysForEmail = function(identity, cb) {
  var m = jsel.match(".emails object:has(.address:val(" + ESC(identity)+ ")) .key", db);
  setTimeout(function() { cb(m); }, 0);
};

exports.removeEmail = function(authenticated_email, email, cb) {
  var m = jsel.match(":root > object:has(.address:val("+ESC(authenticated_email)+")):has(.address:val("+ESC(email)+")) .emails", db);

  if (m.length) {
    var emails = m[0];
    for (var i = 0; i < emails.length; i++) {
      if (emails[i].address === email) {
        emails.splice(i, 1);
        break;
      }
    }
  }

  setTimeout(function() { cb(); }, 0);
};

exports.cancelAccount = function(authenticated_email, cb) {
  emailToUserID(authenticated_email, function(user_id) {
    db.splice(user_id, 1);
    flush();
    cb();
  });
};
