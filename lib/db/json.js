/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

// existsSync moved from path in 0.6.x to fs in 0.8.x
if (typeof fs.existsSync === 'function') {
  var existsSync = fs.existsSync;
} else {
  var existsSync = path.existsSync;
}

// a little alias for stringify
const ESC = JSON.stringify;

var dbPath = path.join(configuration.get('var_path'), "authdb.json");

/* The JSON database. The structure is thus:
 *  [
 *    {
 *      id: <numerical user id>
 *      password: "somepass",
 *      emails: {
 *        "lloyd@hilaiel.com": {
 *          type: 'secondary'
 *        }
 *      }
 *    }
 *  ]
 */

function getNextUserID() {
  var max = 1;
  jsel.forEach(".id", db.users, function(id) {
    if (id >= max) max = id + 1;
  });
  return max;
};

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
  if (existsSync(dbPath)) {
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
  process.nextTick(function() { cb(null); });
};

exports.closeAndRemove = function(cb) {
  // if the file cannot be removed, it's not an error, just means it was never
  // written or deleted by a different process
  try { fs.unlinkSync(dbPath); } catch(e) { }
  process.nextTick(function() { cb(null); });
};

exports.close = function(cb) {
  // don't flush database here to disk, the database is flushed synchronously when
  // written - If we were to flush here we could overwrite changes made by
  // another process - see issue #557
  process.nextTick(function() { cb(null) });
};

exports.emailKnown = function(email, cb) {
  sync();
  var m = jsel.match(".emails ." + ESC(email), db.users);
  process.nextTick(function() { cb(null, m.length > 0) });
};

exports.emailIsVerified = function(email, cb) {
  sync();
  var m = jsel.match(".emails ." + ESC(email), db.users);
  process.nextTick(function() {
    if (!m.length) cb("no such email");
    else cb(null, m[0].verified);
  });
};

exports.emailType = function(email, cb) {
  sync();
  var m = jsel.match(".emails ." + ESC(email), db.users);
  process.nextTick(function() { cb(null, m.length ? m[0].type : undefined); });
};

exports.isStaged = function(email, cb) {
  if (cb) {
    setTimeout(function() {
      sync();
      cb(null, db.stagedEmails.hasOwnProperty(email));
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
    setTimeout(function() { cb(null, d); }, 0);
  }
};

exports.emailsBelongToSameAccount = function(lhs, rhs, cb) {
  sync();
  var m = jsel.match(".emails:has(."+ESC(lhs)+"):has(."+ESC(rhs)+")", db.users);
  process.nextTick(function() {
    cb(null, m && m.length == 1);
  });
};

exports.emailToUID = function(email, cb) {
  sync();
  var m = jsel.match(":root > object:has(.emails > ." + ESC(email) + ") > .id", db.users);
  if (m.length === 0) m = undefined;
  else m = m[0];
  process.nextTick(function() {
    cb(null, m);
  });
};

exports.userOwnsEmail = function(uid, email, cb) {
  sync();
  var m = jsel.match(":root > object:has(:root > .id:expr(x=" + ESC(uid) + ")):has(.emails > ." + ESC(email) + ")", db.users);
  process.nextTick(function() {
    cb(null, m && m.length == 1);
  });
};

function addEmailToAccount(userID, email, type, cb) {
  // validate 'type' isn't bogus
  if ([ 'secondary', 'primary' ].indexOf(type) === -1) {
    return process.nextTick(function() {
      cb("invalid type");
    });
  }

  process.nextTick(function() {
    sync();
    var emails = jsel.match(":has(.id:expr(x="+ ESC(userID) +")) > .emails", db.users);
    if (emails && emails.length > 0) {
      emails[0][email] = { type: type, verified: true };
      flush();
    }
    cb(null);
  });
}

exports.stageUser = function(email, hash, cb) {
  secrets.generate(48, function(secret) {
    // overwrite previously staged users
    sync();
    db.staged[secret] = {
      type: "add_account",
      email: email,
      passwd: hash,
      when: (new Date()).getTime()
    };
    db.stagedEmails[email] = secret;
    flush();
    process.nextTick(function() { cb(null, secret); });
  });
};

exports.stageEmail = function(existing_user, new_email, hash, cb) {
  secrets.generate(48, function(secret) {
    // overwrite previously staged users
    sync();
    db.staged[secret] = {
      type: "add_email",
      existing_user: existing_user,
      email: new_email,
      passwd: hash,
      when: (new Date()).getTime()
    };
    db.stagedEmails[new_email] = secret;
    flush();

    process.nextTick(function() { cb(null, secret); });
  });
};

exports.createUserWithPrimaryEmail = function(email, cb) {
  var emailVal = { };
  emailVal[email] = { type: 'primary', verified: true };
  var uid = getNextUserID();
  db.users.push({
    id: uid,
    password: null,
    emails: emailVal
  });
  flush();
  process.nextTick(function() {
    cb(null, uid);
  });
};

exports.haveVerificationSecret = function(secret, cb) {
  process.nextTick(function() {
    sync();
    cb(null, !!(db.staged[secret]));
  });
};


exports.emailForVerificationSecret = function(secret, cb) {
  process.nextTick(function() {
    sync();
    if (!db.staged[secret]) return cb("no such secret");
    cb(null, db.staged[secret].email, db.staged[secret].existing_user, db.staged[secret].passwd);
  });
};

exports.authForVerificationSecret = function(secret, cb) {
  process.nextTick(function() {
    sync();
    if (!db.staged[secret]) return cb("no such secret");

    if (db.staged[secret].passwd) {
      return cb(null, db.staged[secret].passwd, db.staged[secret].existing_user);
    }

    exports.checkAuth(db.staged[secret].existing_user, function (err, hash) {
      cb(err, hash, db.staged[secret].existing_user);
    });
  });
};


exports.verificationSecretForEmail = function(email, cb) {
  setTimeout(function() {
    sync();
    cb(null, db.stagedEmails[email]);
  }, 0);
};

function getAndDeleteRowForSecret(secret, cb) {
  sync();
  if (!db.staged.hasOwnProperty(secret)) return cb("unknown secret");

  // simply move from staged over to the emails "database"
  var o = db.staged[secret];
  delete db.staged[secret];
  delete db.stagedEmails[o.email];
  flush();
  
  process.nextTick(function() { cb(null, o); });
}

// either a email re-verification, or an email addition - we treat these things
// the same
exports.completeConfirmEmail = function(secret, cb) {
  getAndDeleteRowForSecret(secret, function(err, o) {
    exports.emailKnown(o.email, function(err, known) {
      function addIt() {
        addEmailToAccount(o.existing_user, o.email, 'secondary', function(e) {
          var hash = o.passwd;
          if(e || typeof hash !== 'string') return cb(e, o.email, o.existing_user);

          // a hash was specified, update the password for the user
          exports.emailToUID(o.email, function(err, uid) {
            if(err) return cb(err, o.email, o.existing_user);

            exports.updatePassword(uid, hash, function(err) {
              cb(err || null, o.email, o.existing_user);
            });
          });
        });
      }
      if (known) {
        removeEmailNoCheck(o.email, function (err) {
          if (err) cb(err);
          else addIt();
        });
      } else {
        addIt();
      }
    });
  });
}

exports.completeCreateUser = function(secret, cb) {
  getAndDeleteRowForSecret(secret, function(err, o) {
    exports.emailKnown(o.email, function(err, known) {
      function createAccount() {
        var emailVal = {};
        emailVal[o.email] = { type: 'secondary', verified: true };
        var uid = getNextUserID();
        var hash = o.passwd;
        db.users.push({
          id: uid,
          password: hash,
          emails: emailVal
        });
        flush();
        cb(null, o.email, uid);
      }

      // if this email address is known and a user has completed a re-verification of this email
      // address, remove the email from the old account that it was associated with, and then
      // create a brand new account with only this email.
      // NOTE: this might be sub-optimal, but it's a dead simple approach that mitigates many attacks
      // and gives us reasonable behavior (without explicitly supporting) in the face of shared email
      // addresses.
      if (known) {
        removeEmailNoCheck(o.email, function (err) {
          if (err) cb(err);
          else createAccount();
        });
      } else {
        createAccount();
      }
    });
  });
};

exports.completePasswordReset = function(secret, cb) {
  getAndDeleteRowForSecret(secret, function(err, o) {
    exports.emailKnown(o.email, function(err, known) {
      if (err) return cb(err);

      exports.emailToUID(o.email, function(err, uid) {
        if (err) return cb(err);

        // if for some reason the email is associated with a different user now than when
        // the action was initiated, error out.
        if (uid !== o.existing_user) {
          return cb("cannot update password, data inconsistency");
        }

        sync();
        // flip the verification bit on all emails for the user other than the one just verified
        var emails = jsel.match(":has(.id:expr(x=?)) > .emails", [ uid ], db.users)[0];        

        Object.keys(emails).forEach(function(email) {
          if (email != o.email && emails[email].type === 'secondary') {
            emails[email].verified = false;
          } 
        });
        flush();

        // update the password!
        exports.updatePassword(uid, o.passwd, function(err) {
          cb(err, o.email, uid);
        });
      });
    });
  });
};

exports.addPrimaryEmailToAccount = function(userID, emailToAdd, cb) {
  sync();
  exports.emailKnown(emailToAdd, function(err, known) {
    function addIt() {
      addEmailToAccount(userID, emailToAdd, 'primary', cb);
    }
    if (known) {
      removeEmailNoCheck(emailToAdd, function (err) {
        if (err) cb(err);
        else addIt();
      });
    } else {
      addIt();
    }
  });
};

exports.checkAuth = function(userID, cb) {
  sync();
  var m = undefined;
  if (userID) {
    m = jsel.match(":root > object:has(:root > .id:expr(x=" + ESC(userID) + ")) > .password", db.users);
    if (m.length === 0) m = undefined;
    else m = m[0];
  }
  process.nextTick(function() { cb(null, m) });
};

exports.userKnown = function(userID, cb) {
  sync();
  var m = jsel.match(":root > object:has(:root > .id:expr(x=" + ESC(userID) + "))", db.users);
  if (m.length === 0) m = undefined;
  else m = m[0];
  process.nextTick(function() { cb(null, m) });
};

exports.updatePassword = function(userID, hash, cb) {
  sync();
  var m = jsel.match(":root > object:has(.id:expr(x=" + ESC(userID) + "))", db.users);
  var err = undefined;
  if (m.length === 0) err = "no such email address";
  else m[0].password = hash;
  flush();
  process.nextTick(function() { cb(err) });
};

exports.listEmails = function(uid, cb) {
  sync();
  var emails = jsel.match(":has(.id:expr(x="+ ESC(uid) +")) > .emails", db.users);
  process.nextTick(function() {
    if (!emails || emails.length != 1) {
      cb("no such user: " + uid);
      return;
    }
    cb(null, emails[0]);
  });
};

exports.removeEmail = function(authenticated_user, email, cb) {
  sync();
  var m = jsel.match(":has(.id:expr(x=" + ESC(authenticated_user) + ")) .emails:has(."+ESC(email)+")", db.users);

  if (m.length) {
    var emails = m[0];
    delete emails[email];
    flush();
  }
  setTimeout(function() { cb(null); }, 0);
};

function removeEmailNoCheck(email, cb) {
  sync();
  var m = jsel.match(".emails:has(."+ESC(email)+")", db.users);
  if (m.length) {
    var emails = m[0];
    delete emails[email];
    flush();
  }
  process.nextTick(function() { cb(null); });
};

exports.cancelAccount = function(authenticated_uid, cb) {
  sync();
  var id = undefined;

  for (var i = 0; i < db.users.length; i++) {
    if (db.users[i].id === authenticated_uid) break;
  }

  if (i < db.users.length) {
    db.users.splice(i, 1);
    flush();
  }

  process.nextTick(function() { cb(null); });
};

exports.addTestUser = function(email, hash, cb) {
  sync();
  removeEmailNoCheck(email, function() {
    var emailVal = {};
    emailVal[email] = { type: 'secondary', verified: true };
    db.users.push({
      id: getNextUserID(),
      password: hash,
      emails: emailVal
    });
    flush();
    cb(null);
  });
};

exports.ping = function(cb) {
  process.nextTick(function() { cb(null); });
};
