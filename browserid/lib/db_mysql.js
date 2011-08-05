/* This is a mysql driver for the browserid server.  It maps the data
 * storage requirements of browserid onto a relational schema.  This
 * driver is intended to be fast and scalable.
 */

/*
 * The Schema:
 *
 *    +--- user ------+       +--- email ----+        +----- key ------+
 *    |*int id        | <-\   |*int id       | <-\    |*int id         |
 *    | string passwd |    \- |*int user     |    \-- |*int email      |
 *    +---------------+       |*string address        | string pubkey  |
 *                            +--------------+        | int expires    |
 *                                                    +----------------+
 *
 *
 *    +------ staged ----------+
 *    |*string secret          |
 *    | bool new_acct          |
 *    | string existing        |
 *    | string email           |
 *    | string pubkey          |
 *    | string passwd          |
 *    | timestamp ts           |
 *    +------------------------+
 */

const
mysql = require('mysql'),
secrets = require('./secrets');

var client = undefined;

// may get defined at open() time causing a database to be dropped upon connection closing.
var drop_on_close = undefined;

const schemas = [
  "CREATE TABLE IF NOT EXISTS user   ( id INTEGER PRIMARY KEY, passwd VARCHAR(64) );",
  "CREATE TABLE IF NOT EXISTS email  ( id INTEGER PRIMARY KEY, user INTEGER, address VARCHAR(255) UNIQUE, INDEX(address) );",
  "CREATE TABLE IF NOT EXISTS pubkey ( id INTEGER PRIMARY KEY, email INTEGER, content TEXT, expiry INTEGER );",
  "CREATE TABLE IF NOT EXISTS staged ( secret VARCHAR(48) PRIMARY KEY, new_acct BOOL, existing VARCHAR(255), email VARCHAR(255) UNIQUE, INDEX(email), pubkey TEXT, passwd VARCHAR(64), ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
];

// open & create the mysql database
exports.open = function(cfg, cb) {
  if (client) throw "database is already open!";
  client = new mysql.Client();
  // mysql config requires
  const defParams = {
    host: '127.0.0.1',
    port: "3306",
    user: 'test',
    password: 'pass',
    unit_test: false
  };

  Object.keys(defParams).forEach(function(param) {
    client[param] = cfg[param] ? cfg.param : defParams[param];
  });

  // let's figure out the database name
  var database = cfg.database;
  if (!database) database = "browserid";
  if (cfg.unit_test) {
    database += "_" + secrets.generate(8);
    drop_on_close = database;
  }

  client.connect(function(error) {
    if (error) cb(error);
    else {
      // now create the databse
      client.query("CREATE DATABASE IF NOT EXISTS " + database, function(err) {
        if (err) {
          cb(err);
          return;
        }
        client.useDatabase(database, function(err) {
          if (err) {
            cb(err);
            return;
          }

          // now create tables
          function createNextTable(i) {
            if (i < schemas.length) {
              client.query(schemas[i], function(err) {
                if (err) cb(err);
                else createNextTable(i+1);
              });
            } else {
              cb();
            }
          }
          createNextTable(0);
        });
      });
    }
  });
};

exports.close = function(cb) {
  function endConn() {
    client.end(function(err) {
      client = undefined;
      if (cb) cb(err);
    });
  }
  // when unit_test is specified at open time, we use a temporary database,
  // and clean it up upon close.
  if (drop_on_close) {
    client.query("DROP DATABASE " + drop_on_close, function() {
      endConn();
    });
  } else {
    endConn();
  }
};

exports.emailKnown = function(email, cb) {
  client.query(
    "SELECT COUNT(*) as N FROM email WHERE address = ?", [ email ],
    function(err, results, fields) {
      cb(results['N'] > 0);
    }
  );
}

exports.isStaged = function(email, cb) {
  client.query(
    "SELECT COUNT(*) as N FROM staged WHERE email = ?", [ email ],
    function(err, results, fields) {
      cb(results['N'] > 0);
    }
  );
}

exports.emailsBelongToSameAccount = function() {
  throw "not implemented";
}

exports.addKeyToEmail = function() {
  throw "not implemented";
}

exports.stageUser = function(obj, cb) {
  var secret = secrets.generate(48);
  // overwrite previously staged users
  client.query('INSERT INTO staged (secret, new_acct, email, pubkey, passwd) VALUES(?,TRUE,?,?,?) ' +
               'ON DUPLICATE KEY UPDATE secret=?, existing="", new_acct=TRUE, pubkey=?, passwd=?',
               [ secret, obj.email, obj.pubkey, obj.hash, secret, obj.pubkey, obj.hash],
               function(err) {
                 if (err) cb(undefined, err);
                 else cb(secret);
               });
}

exports.stageEmail = function() {
  throw "not implemented";
}

exports.gotVerificationSecret = function(secret, cb) {
  client.query(
    "SELECT * FROM staged WHERE secret = ?", [ secret ],
    function(err, rows) {
      if (err) cb(err);
      else if (rows.length === 0) cb("unknown secret");
      else {
        var o = rows[0];

        // delete the record
        client.query("DELETE LOW_PRIORITY FROM staged WHERE secret = ?", [ secret ]);

        // XXX: perform add acct or email depending on value of new_acct BOOL
        console.log(o);
      }
    }
  );
}

exports.checkAuth = function() {
  throw "not implemented";
}

exports.getSyncResponse = function() {
  throw "not implemented";
}

exports.pubkeysForEmail = function() {
  throw "not implemented";
}

exports.removeEmail = function() {
  throw "not implemented";
}

exports.cancelAccount = function() {
  throw "not implemented";
}
