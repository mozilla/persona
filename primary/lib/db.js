const sqlite = require('sqlite'),
        path = require('path');

var db = new sqlite.Database();

db.open(path.join(path.dirname(__dirname), "var", "userdb.sqlite"), function (error) {
  if (error) {
    console.log("Couldn't open database: " + error);
    throw error;
  }

  function createTable(name, sql) {
    db.execute(sql, function (error, rows) {
      if (error) {
        console.log("Couldn't create " + name + " table: " + error);
        throw error;
      }
    });
  }

  createTable('users',  "CREATE TABLE IF NOT EXISTS users  ( id INTEGER PRIMARY KEY, name TEXT, password TEXT )");// NB "password" is SHA1 of actual PW
  createTable('keys',   "CREATE TABLE IF NOT EXISTS keys   ( id INTEGER PRIMARY KEY, user INTEGER, key TEXT, expires INTEGER )");
});

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

exports.usernameToUserID = function(username, cb) {
  db.execute(
    "SELECT id FROM users WHERE name = ?",
    [ username ],
    function (err, rows) {
      if (rows && rows.length == 1) {
        cb(rows[0].id);
      } else {
        if (err) console.log("database error: " + err);
        cb(undefined);
      }
    });
}



exports.userIDToUsername = function(userid, cb) {
  db.execute(
    "SELECT name FROM users WHERE id = ?",
    [ userid ],
    function (err, rows) {
      if (rows && rows.length == 1) {
        cb(rows[0].name);
      } else {
        if (err) console.log("database error: " + err);
        cb(undefined);
      }
    });
}

exports.usernameKnown = function(username, cb) {
  db.execute(
    "SELECT id FROM users WHERE name = ?",
    [ username ],
    function(error, rows) {
      cb(rows && rows.length > 0);
    });
};

/* Given a username, adds a public key to it */
exports.addKeyToAccount = function(userID, pubkey, cb) {
  executeTransaction([
     [ "INSERT INTO keys (user, key, expires) VALUES(?,?,?)",
       [ userID, pubkey, ((new Date()).getTime() + (14 * 24 * 60 * 60 * 1000)) ]
     ]
    ], function (error) {
       if (error) cb(error);
       else cb();
  });
}

/* create a user account, with no saved keys */
exports.create_user = function(username, password, cb) {

  if (exports.usernameKnown(username, function(known) {
    if (known) cb("email already exists!");
    else {
      executeTransaction([
        [ "INSERT INTO users (name, password) VALUES(?,?)", [ username, password ] ]
      ], function (error) {
        if (error) cb(error);
        else cb();
      });
    }
  }));
};

/* check username and password; returns true if the password hash matches. */
exports.checkAuth = function(username, pass, cb) {
  db.execute("SELECT id FROM users WHERE name = ? AND password = ?",
             [ username, pass ],
             function (error, rows) {
                if (rows.length == 1) {
                  cb(rows[0].id);
                } else {
                  cb(null);
                }
             });
};

/* Given a username return an array of public keys for it */
exports.pubkeysForUsername = function(username, cb) {
  db.execute('SELECT keys.key FROM keys, users WHERE users.name = ? AND keys.user = users.id',
     [ username ],
     function(err, rows) {
       var keys = undefined;
       if (!err && rows && rows.length) {
         keys = [ ];
         for (var i = 0; i < rows.length; i++) keys.push(rows[i].key);
       }
       cb(keys);
     });
};

/* TODO: write flush_keys */