const sqlite = require('sqlite'),
      path = require('path'),
      bcrypt = require('bcrypt');

var VAR_DIR = path.join(path.dirname(__dirname), "var");

var db = new sqlite.Database();
var dbPath = path.join(VAR_DIR, "authdb.sqlite");

var ready = false;
var waiting = [];

db.open(dbPath, function (error) {
  if (error) {
    console.log("Couldn't open database: " + error);
    throw error;
  }
  db.executeScript(
    "CREATE TABLE IF NOT EXISTS users  ( id INTEGER PRIMARY KEY, password TEXT );" +
    "CREATE TABLE IF NOT EXISTS emails ( id INTEGER PRIMARY KEY, user INTEGER, address TEXT UNIQUE );" +
    "CREATE TABLE IF NOT EXISTS keys   ( id INTEGER PRIMARY KEY, email INTEGER, key TEXT, expires INTEGER )",
    function (error) {
      if (error) {
        throw error;
      }
      ready = true;
      waiting.forEach(function(f) { f() });
      waiting = [];
    });
});

exports.onReady = function(f) {
  setTimeout(function() {
    if (ready) f();
    else waiting.push(f);
  }, 0);
};

// half created user accounts (pending email verification)
// OR
// half added emails (pending verification)
var g_staged = {
};

// an email to secret map for efficient fulfillment of isStaged queries
var g_stagedEmails = {
};

function executeTransaction(statements, cb) {
  function executeTransaction2(statements, cb) {
    if (statements.length == 0) cb();
    else {
      var s = statements.shift();
      db.execute(s[0], s[1], function(err, rows) {
        if (err) cb(err);
        else executeTransaction2(statements, cb);
      });
    }
  }

  db.execute('BEGIN', function(err, rows) {
    executeTransaction2(statements, function(err) {
      if (err) cb(err);
      else db.execute('COMMIT', function(err, rows) {
        cb(err);
      });
    });
  });
}

function emailToUserID(email, cb) {
  db.execute(
    'SELECT users.id FROM emails, users WHERE emails.address = ? AND users.id == emails.user',
    [ email ],
    function (err, rows) {
      if (rows && rows.length == 1) {
        cb(rows[0].id);
      } else {
        if (err) console.log("database error: " + err);
        cb(undefined);
      }
    });
}

exports.findByEmail = function(email) {
  for (var i = 0; i < g_users.length; i++) {
    for (var j = 0; j < g_users[i].emails.length; j++) {
      if (email === g_users[i].emails[j]) return g_users[i];
    }
  }
  return undefined;
};

exports.emailKnown = function(email, cb) {
  db.execute(
    "SELECT id FROM emails WHERE address = ?",
    [ email ],
    function(error, rows) {
      cb(rows.length > 0);
    });
};

exports.isStaged = function(email) {
  return g_stagedEmails.hasOwnProperty(email);
};

function generateSecret() {
  var str = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i=0; i < 48; i++) {
    str += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return str;
}

exports.addEmailToAccount = function(existing_email, email, pubkey, cb) {
  emailToUserID(existing_email, function(userID) {
    if (userID == undefined) {
      cb("no such email: " + existing_email, undefined);
    } else {
      executeTransaction([
        [ "INSERT INTO emails (user, address) VALUES(?,?)", [ userID, email ] ],
        [ "INSERT INTO keys (email, key, expires) VALUES(last_insert_rowid(),?,?)",
          [ pubkey, ((new Date()).getTime() + (14 * 24 * 60 * 60 * 1000)) ]
        ]
      ], function (error) {
        if (error) cb(error);
        else cb();
      });
    }
  });
}

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

/* takes an argument object including email, password hash, and pubkey. */
exports.stageUser = function(obj) {
  var secret = generateSecret();

  // overwrite previously staged users
  g_staged[secret] = {
    type: "add_account",
    email: obj.email,
    pubkey: obj.pubkey,
    pass: obj.hash
  };

  g_stagedEmails[obj.email] = secret;
  return secret;
};

/* takes an argument object including email, pass, and pubkey. */
exports.stageEmail = function(existing_email, new_email, pubkey) {
  var secret = generateSecret();
  // overwrite previously staged users
  g_staged[secret] = {
    type: "add_email",
    existing_email: existing_email,
    email: new_email,
    pubkey: pubkey
  };
  g_stagedEmails[new_email] = secret;
  return secret;
};

/* invoked when a user clicks on a verification URL in their email */ 
exports.gotVerificationSecret = function(secret, cb) {
  if (!g_staged.hasOwnProperty(secret)) return cb("unknown secret");

  // simply move from staged over to the emails "database"
  var o = g_staged[secret];
  delete g_staged[secret];
  delete g_stagedEmails[o.email];
  if (o.type === 'add_account') {
    exports.emailKnown(o.email, function(known) {
      function createAccount() {
        executeTransaction([
          [ "INSERT INTO users (password) VALUES(?)", [ o.pass ] ] ,
          [ "INSERT INTO emails (user, address) VALUES(last_insert_rowid(),?)", [ o.email ] ],
          [ "INSERT INTO keys (email, key, expires) VALUES(last_insert_rowid(),?,?)",
            [ o.pubkey, ((new Date()).getTime() + (14 * 24 * 60 * 60 * 1000)) ]
          ]
        ], function (error) {
          if (error) cb(error);
          else cb();
        });
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
    exports.addEmailToAccount(o.existing_email, o.email, o.pubkey, cb);
  } else {
    cb("internal error");
  }
};

exports.checkAuth = function(email, pass, cb) {
  db.execute("SELECT users.password FROM emails, users WHERE users.id = emails.user AND emails.address = ?",
             [ email ],
             function (error, rows) {
               cb(rows.length === 1 && bcrypt.compare_sync(pass, rows[0].password));
             });
};

exports.checkAuthHash = function(email, hash, cb) {
  db.execute("SELECT users.password FROM emails, users WHERE users.id = emails.user AND emails.address = ? AND users.password = ?",
             [ email, hash ],
             function (error, rows) {
               cb(rows.length === 1);
             });
};


/* a high level operation that attempts to sync a client's view with that of the
 * server.  email is the identity of the authenticated channel with the user,
 * identities is a map of email -> pubkey.
 * We'll return an object that expresses three different types of information:
 * there are several things we need to express:
 * 1. emails that the client knows about but we do not
 * 2. emails that we know about and the client does not
 * 3. emails that we both know about but who need to be re-keyed
 * NOTE: it's not neccesary to differentiate between #2 and #3, as the client action
 *       is the same (regen keypair and tell us about it).
 */
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
          for (var i = 0; i < rows.length; i++) emails.push(rows[i].address);

          // #1
          for (var e in identities) {
            if (emails.indexOf(e) == -1) respBody.unknown_emails.push(e);
          }

          // #2
          for (var e in emails) {
            e = emails[e];
            if (!identities.hasOwnProperty(e)) respBody.key_refresh.push(e);
          }

          // #3
          // XXX todo

          cb(undefined, respBody); 
        }
      });
  });
};


exports.pubkeysForEmail = function(identity, cb) {
  db.execute('SELECT keys.key FROM keys, emails WHERE emails.address = ? AND keys.email = emails.id',
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


// FIXME: I'm not sure I'm using this data model properly
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