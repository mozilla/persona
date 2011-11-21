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
secrets = require('../secrets.js'),
jsel = require('JSONSelect'),
logger = require('../logging.js').logger,
configuration = require('../configuration.js'),
temp = require('temp');

// a little alias for stringify
const ESC = JSON.stringify;

var dbPath = path.join(configuration.get('var_path'), "authdb.json");

/* The JSON database. The structure is thus:
 *  [
 *    {
 *      password: "somepass",
 *      emails: [
 *        "lloyd@hilaiel.com"
 *      ]
 *    }
 *  ]
 */

var db = {
  users: [ ],
  stagedEmails: { },
  staged: { }
};

function flush() {
  try {
    var e = fs.writeFileSync(dbPath, JSON.stringify(db));
  } catch (e) {
    logger.error("Cannot save database to " + dbPath);
  }
}

function sync() {
  // the database not existing yet just means its empty, don't log an error
  if (path.existsSync(dbPath)) {
    try {
      db = JSON.parse(fs.readFileSync(dbPath));

      // FIXME:
      // at this point db might be missing some important fields
      // we may want to fix this. In the meantime, delete your old json db
    } catch(e) {
      logger.error("Cannot read database from " + dbPath);
    }
  } else {
    logger.debug("Database doesn't exist (yet): " + dbPath);
  }
}

exports.open = function(cfg, cb) {
  if (cfg && cfg.path) {
    dbPath = cfg.path;
  }
  logger.debug("opening JSON database: " + dbPath);

  sync();

  setTimeout(cb, 0);
};

exports.closeAndRemove = function(cb) {
  fs.unlink(dbPath, function(err) { cb(err === null ? undefined : err); });
};

exports.close = function(cb) {
  // don't flush database here to disk, the database is flushed synchronously when
  // written - If we were to flush here we could overwrite changes made by
  // another process - see issue #557
  setTimeout(function() { cb(undefined) }, 0);
};

exports.emailKnown = function(email, cb) {
  sync();
  var m = jsel.match(".emails :val(" + ESC(email) + ")", db.users);
  setTimeout(function() { cb(m.length > 0) }, 0);
};

exports.isStaged = function(email, cb) {
  if (cb) {
    setTimeout(function() {
      sync();
      cb(db.stagedEmails.hasOwnProperty(email));
    }, 0);
  }
};

exports.lastStaged = function(email, cb) {
  if (cb) {
    sync();
    var d;
    if (db.stagedEmails.hasOwnProperty(email)) {
      d = new Date(db.staged[db.stagedEmails[email]].when);
    }
    setTimeout(function() { cb(d); }, 0);
  }
};

exports.emailsBelongToSameAccount = function(lhs, rhs, cb) {
  sync();
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

function addEmailToAccount(existing_email, email, cb) {
  emailToUserID(existing_email, function(userID) {
    if (userID == undefined) {
      cb("no such email: " + existing_email, undefined);
    } else {
      db.users[userID].emails.push(email);
      flush();
      cb();
    }
  });
}

exports.stageUser = function(email, cb) {
  var secret = secrets.generate(48);

  // overwrite previously staged users
  sync();
  db.staged[secret] = {
    type: "add_account",
    email: email,
    when: (new Date()).getTime()
  };
  db.stagedEmails[email] = secret;
  flush();
  setTimeout(function() { cb(secret); }, 0);
};

exports.stageEmail = function(existing_email, new_email, cb) {
  var secret = secrets.generate(48);

  // overwrite previously staged users
  sync();
  db.staged[secret] = {
    type: "add_email",
    existing_email: existing_email,
    email: new_email,
    when: (new Date()).getTime()
  };
  db.stagedEmails[new_email] = secret;
  flush();

  setTimeout(function() { cb(secret); }, 0);
};


exports.emailForVerificationSecret = function(secret, cb) {
  setTimeout(function() {
    sync();
    cb(db.staged[secret] ? db.staged[secret].email : undefined);
  }, 0);
};

exports.verificationSecretForEmail = function(email, cb) {
  setTimeout(function() {
    sync();
    cb(db.stagedEmails[email]);
  }, 0);
};

exports.gotVerificationSecret = function(secret, hash, cb) {
  sync();
  if (!db.staged.hasOwnProperty(secret)) return cb("unknown secret");

  // simply move from staged over to the emails "database"
  var o = db.staged[secret];
  delete db.staged[secret];
  delete db.stagedEmails[o.email];
  flush();
  if (o.type === 'add_account') {
    exports.emailKnown(o.email, function(known) {
      function createAccount() {
        db.users.push({
          password: hash,
          emails: [ o.email ]
        });
        flush();
        cb(undefined, o.email);
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
        addEmailToAccount(o.existing_email, o.email, cb);
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
  sync();
  var m = jsel.match(":root > object:has(.emails > :val(" + ESC(email) + ")) > .password", db.users);
  if (m.length === 0) m = undefined;
  else m = m[0];
  setTimeout(function() { cb(m) }, 0);
};

exports.updatePassword = function(email, hash, cb) {
  sync();
  var m = jsel.match(":root > object:has(.emails > :val(" + ESC(email) + "))", db.users);
  var err = undefined;
  if (m.length === 0) err = "no such email address";
  else m[0].password = hash;
  flush();
  setTimeout(function() { cb(err) }, 0);
};

function emailToUserID(email, cb) {
  sync();
  var id = undefined;

  for (var i = 0; i < db.users.length; i++) {
    if (jsel.match(":val(" + JSON.stringify(email) + ")", db.users[i]).length) {
      id = i;
      break;
    }
    if (id !== undefined) break;
  }

  setTimeout(function() { cb(id); }, 0);
}

exports.listEmails = function(email, cb) {
  sync();
  // get the user id associated with this account
  emailToUserID(email, function(userID) {
    if (userID === undefined) {
      cb("no such email: " + email);
      return;
    }
    var email_list = jsel.match(".emails string", db.users[userID]);
    var emails = {};
    for (var i=0; i < email_list.length; i++)
      emails[email_list[i]] = {};

    cb(null, emails);
  });
};

exports.removeEmail = function(authenticated_email, email, cb) {
  sync();
  var m = jsel.match(".emails:has(:val("+ESC(authenticated_email)+")):has(:val("+ESC(email)+"))", db.users);

  if (m.length) {
    var emails = m[0];
    for (var i = 0; i < emails.length; i++) {
      if (emails[i] === email) {
        emails.splice(i, 1);
        flush();
        break;
      }
    }
  }
  setTimeout(function() { cb(); }, 0);
};

exports.cancelAccount = function(authenticated_email, cb) {
  emailToUserID(authenticated_email, function(user_id) {
    db.users.splice(user_id, 1);
    flush();
    cb();
  });
};
