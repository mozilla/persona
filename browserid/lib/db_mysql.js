/* This is a mysql driver for the browserid server.  It maps the data
 * storage requirements of browserid onto a relational schema.  This
 * driver is intended to be fast and scalable.
 */

/*
 * The Schema:
 *
 *    +--- user ------+       +--- email ----+        +----- key ------+
 *    |*int id        | <-\   |*int id       | <-\    |*int id         |
 *    | text password |    \- |*int user     |    \-- |*int email      |
 *    +---------------+       | text address |        | text key       |
 *                            +--------------+        | int expires    |
 *                                                    +----------------+
 *
 *
 *
 */

const
mysql = require('mysql');

var client = new mysql.Client();

const schemas = [
  "CREATE TABLE IF NOT EXISTS user   ( id INTEGER PRIMARY KEY, password TEXT );",
  "CREATE TABLE IF NOT EXISTS email  ( id INTEGER PRIMARY KEY, user INTEGER, address VARCHAR(255) UNIQUE );",
  "CREATE TABLE IF NOT EXISTS pubkey ( id INTEGER PRIMARY KEY, email INTEGER, content TEXT, expiry INTEGER );"
];

// open & create the mysql database
exports.open = function(cfg, cb) {
  // mysql config requires
  const defParams = {
    host: '127.0.0.1',
    port: "3306",
    user: 'test',
    password: 'pass'
  };

  Object.keys(defParams).forEach(function(param) {
    client[param] = cfg[param] ? config.param : defParams[param];
  });

  var database = cfg.database ? cfg.database : 'browserid';

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
  client.end(function(err) {
    if (cb) cb(err);
  });
};

exports.emailKnown = function() {
  throw "not implemented";
}

exports.isStaged = function() {
  throw "not implemented";
}

exports.emailsBelongToSameAccount = function() {
  throw "not implemented";
}

exports.addKeyToEmail = function() {
  throw "not implemented";
}

exports.stageUser = function() {
  throw "not implemented";
}

exports.stageEmail = function() {
  throw "not implemented";
}

exports.gotVerificationSecret = function() {
  throw "not implemented";
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
