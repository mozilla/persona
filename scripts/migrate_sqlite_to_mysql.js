#!/usr/bin/env node

/* A lil' node.js script to perform a one time migration from sqlite to
 * mysql */

const
mysql = require('mysql'),
path = require('path'),
sqlite = require('sqlite');

const schemas = [
  "CREATE TABLE user   ( id INTEGER AUTO_INCREMENT PRIMARY KEY, passwd VARCHAR(64) );",
  "CREATE TABLE email  ( id INTEGER AUTO_INCREMENT PRIMARY KEY, user INTEGER, address VARCHAR(255) UNIQUE, INDEX(address) );",
  "CREATE TABLE pubkey ( id INTEGER AUTO_INCREMENT PRIMARY KEY, email INTEGER, content TEXT, expiry DATETIME );",
  "CREATE TABLE staged ( secret VARCHAR(48) PRIMARY KEY, new_acct BOOL, existing VARCHAR(255), email VARCHAR(255) UNIQUE, INDEX(email), pubkey TEXT, passwd VARCHAR(64), ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
];

// #1 open connection to mysql
client = new mysql.Client();

// mysql config requires                                                      
client['host'] = '127.0.0.1';
client['port'] = "3306";
client['user'] = "browserid";
client['password'] = "";

function fatal(err) {
  console.log("ERROR:", err.toString()); 
  process.exit(1);
}

client.connect(function(error) {
  if (error) {
    fatal(error);
  } else {
    // now create the databse                                                 
    client.useDatabase("browserid", function(err) {
      if (err) fatal(err);
      function createNextTable(i) {
        if (i < schemas.length) {
          client.query(schemas[i], function(err) {
            if (err) {
              fatal(err);
            } else {
              createNextTable(i+1);
            }
          });
        } else {
          onMysqlReady();
        }
      }
      createNextTable(0);
    });
  }
});

var sqlitedb;

function onMysqlReady() {
  // now connect up to sqlite
  sqlitedb = new sqlite.Database();

  // a configurable parameter if set immediately after require() of db.js
  var dbPath = path.join(__dirname, "authdb.sqlite");

  sqlitedb.open(dbPath, function (error) {
    if (error) fatal(error);
    onSQLITEReady();
  });
}

function getAllRows(table, start, gotRowCallback) {
  var sql = "select * from " + table;
  sqlitedb.query(sql, function(e, r) {
    if (e) fatal(e);
    gotRowCallback(r);
  });
}

var done = 0;
function checkDone() {
  if (done++ == 2) {
    client.end(function() {
      console.log("all done!");
      process.exit(0);
    });
  }                     
}

function onSQLITEReady() {
  console.log("getting all rows");
  getAllRows("users", 0, function(row) {
    if (row) {
      client.query('INSERT INTO user (id, passwd) VALUES(?,?)',
                   [ row.id, row.password ]);
    } else {
      checkDone();
    }
  });
  getAllRows("emails", 0, function(row) {
    if (row) {
      client.query('INSERT INTO email (id, user, address) VALUES(?,?,?)  ON DUPLICATE KEY UPDATE id=?',
                   [ row.id, row.user, row.address, row.id ]);
    } else {
      checkDone();
    }
  });
  getAllRows("keys", 0, function(row) {
    if (row) {
      client.query('INSERT INTO pubkey (id, email, content, expiry) VALUES(?,?,?,?)',
                   [ row.id, row.email, row.key, row.expires ]);
    } else {
      checkDone();
    }
  });
}