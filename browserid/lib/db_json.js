const
path = require('path'),
fs = require('fs'),
secrets = require('./secrets');

var VAR_DIR = path.join(path.dirname(__dirname), "var");

var dbPath = path.join(VAR_DIR, "authdb.json");

var db = [];
var stagedEmails = { };
var staged = { };

function flush() {
  fs.writeFileSync(JSON.stringify(db));
}

exports.open = function(cfg, cb) {
  if (cfg && cfg.path) dbPath = cfg.path;
  try {
    db = JSON.parse(fs.readFileSync(dbPath));
  } catch(e) {
  }

  setTimeout(cb, 0);
};

exports.close = function(cb) {
  flush();
  setTimeout(cb, 0);
};

exports.emailKnown = function(email, cb) {
  for (var i = 0; i < db.length; i++) {
    if (db[i].emails.hasOwnProperty(email)) {
      setTimeout(function() { cb(true) }, 0);
      return;
    }
  }
  setTimeout(function() { cb(false) }, 0);
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

exports.addKeyToEmail = function(existing_email, email, pubkey, cb) {
  emailToUserID(existing_email, function(userID) {
    if (userID == undefined) {
      cb("no such email: " + existing_email, undefined);
      return;
    }

    if (db[userID].emails

    db.execute("SELECT emails.id FROM emails,users WHERE users.id = ? AND emails.address = ? AND emails.user = users.id",
               [ userID, email ],
               function(err, rows) {
                 if (err || rows.length != 1) {
                   cb(err);
                   return;
                 }
                 executeTransaction([
                   [ "INSERT INTO keys (email, key, expires) VALUES(?,?,?)",
                     [ rows[0].id, pubkey, ((new Date()).getTime() + (14 * 24 * 60 * 60 * 1000)) ]
                   ]
                 ], function (error) {
                   if (error) cb(error);
                   else cb();
                 });
               });
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
                expires: ((new Date()).getTime() + (14 * 24 * 60 * 60 * 1000)) 
              } ]
            }
          ]
        });
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
  db.execute("SELECT users.password FROM emails, users WHERE users.id = emails.user AND emails.address = ?",
             [ email ],
             function (error, rows) {
               cb(rows.length !== 1 ? undefined : rows[0].password);
             });
};

function emailToUserID(email, cb) {
  var id = undefined;
  
  for (var i = 0; i < db.length; i++) {
    for (var j = 0; j < db[i].emails.length; j++) {
      if (db[i].emails[j].address === email) {
        id = i;
        break;
      }
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
    db.execute(
      'SELECT address FROM emails WHERE ? = user',
      [ userID ],
      function (err, rows) {
        if (err) cb(err);
        else {
          var emails = [ ];
          var keysToCheck = [ ];
          for (var i = 0; i < rows.length; i++) emails.push(rows[i].address);

          // #1
          for (var e in identities) {
            if (emails.indexOf(e) == -1) respBody.unknown_emails.push(e);
            else keysToCheck.push(e);
          }

          // #2
          for (var e in emails) {
            e = emails[e];
            if (!identities.hasOwnProperty(e)) respBody.key_refresh.push(e);
          }

          // #3 -- yes, this is sub-optimal in terms of performance.  when we
          // move away from public keys this will be unnec.
          if (keysToCheck.length) {
            var checked = 0;
            keysToCheck.forEach(function(e) {
              emailHasPubkey(e, identities[e], function(v) {
                checked++;
                if (!v) respBody.key_refresh.push(e);
                if (checked === keysToCheck.length) {
                  cb(undefined, respBody);
                }
              });
            });
          } else {
            cb(undefined, respBody);
          }
        }
      });
  });
};

exports.pubkeysForEmail = function(identity, cb) {
  db.execute(
    'SELECT keys.key FROM keys, emails WHERE emails.address = ? AND keys.email = emails.id',
    [ identity ],
    function(err, rows) {
      var keys = undefined;
      if (!err && rows && rows.length) {
        keys = [ ];
        for (var i = 0; i < rows.length; i++) keys.push(rows[i].key);
      }
      cb(keys);
    });
};

exports.removeEmail = function(authenticated_email, email, cb) {
  // figure out the user, and remove Email only from addressed
  // linked to the authenticated email address
  emailToUserID(authenticated_email, function(user_id) {
    executeTransaction([
      [ "delete from emails where emails.address = ? and user = ?", [ email,user_id ] ] ,
      [ "delete from keys where email in (select address from emails where emails.address = ? and user = ?)", [ email,user_id ] ],
    ], function (error) {
      if (error) cb(error);
      else cb();
    });
  });
};

exports.cancelAccount = function(authenticated_email, cb) {
  emailToUserID(authenticated_email, function(user_id) {
    executeTransaction([
      [ "delete from emails where user = ?", [ user_id ] ] ,
      [ "delete from keys where email in (select address from emails where user = ?)", [ user_id ] ],
      [ "delete from users where id = ?", [ user_id ] ],
    ], function (error) {
      if (error) cb(error);
      else cb();
    });
  });
};
