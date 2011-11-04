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

/* This is a mysql driver for the browserid server.  It maps the data
 * storage requirements of browserid onto a relational schema.  This
 * driver is intended to be fast and scalable.
 */

/*
 * The Schema:
 *
 *    +--- user ------+       +--- email ----+
 *    |*int id        | <-\   |*int id       |
 *    | string passwd |    \- |*int user     |
 *    +---------------+       |*string address
 *                            +--------------+
 *
 *
 *    +------ staged ----------+
 *    |*int id                 |
 *    |*string secret          |
 *    | bool new_acct          |
 *    | string existing        |
 *    |*string email           |
 *    | timestamp ts           |
 *    +------------------------+
 */

const
mysql = require('mysql'),
secrets = require('../../libs/secrets'),
logger = require('../../libs/logging.js').logger;

var client = undefined;

// may get defined at open() time causing a database to be dropped upon connection closing.
var drop_on_close = undefined;

// If you change these schemas, please notify <services-ops@mozilla.com>
const schemas = [
  "CREATE TABLE IF NOT EXISTS user (" +
    "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
    "passwd CHAR(64) NOT NULL" +
    ") ENGINE=InnoDB;",

  "CREATE TABLE IF NOT EXISTS email (" +
    "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
    "user BIGINT NOT NULL," +
    "address VARCHAR(255) UNIQUE NOT NULL," + 
    "FOREIGN KEY user_fkey (user) REFERENCES user(id)" +
    ") ENGINE=InnoDB;",

  "CREATE TABLE IF NOT EXISTS staged (" +
    "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
    "secret CHAR(48) UNIQUE NOT NULL," +
    "new_acct BOOL NOT NULL," +
    "existing VARCHAR(255)," +
    "email VARCHAR(255) UNIQUE NOT NULL," +
    "ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL" + 
    ") ENGINE=InnoDB;",
];

// log an unexpected database error
function logUnexpectedError(detail) {
  // first, get line number of callee
  var where;
  try { dne; } catch (e) { where = e.stack.split('\n')[2].trim(); };
  // now log it!
  logger.error("unexpected database failure: " + detail + " -- " + where);
}

// open & create the mysql database
exports.open = function(cfg, cb) {
  if (client) throw "database is already open!";
  // mysql config requires
  var options = {
    host: '127.0.0.1',
    port: "3306",
    user: undefined,
    password: undefined,
    unit_test: false
  };

  Object.keys(options).forEach(function(param) {
    options[param] = (cfg[param] !== undefined ? cfg[param] : options[param]);
    if (options[param] === undefined) delete options[param];
  });

  // create the client
  client = mysql.createClient(options);

  // let's figure out the database name
  var database = cfg.database;
  if (!database) database = "browserid";
  if (cfg.unit_test) {
    database += "_" + secrets.generate(8);
    drop_on_close = database;
  }

  // now create the databse
  if (cfg.create_schema || cfg.unit_test) {
    client.query("CREATE DATABASE IF NOT EXISTS " + database, function(err) {
      if (err) {
        logUnexpectedError(err);
        cb(err);
        return;
      }
      client.useDatabase(database, function(err) {
        if (err) {
          logUnexpectedError(err);
          cb(err);
          return;
        }

        // now create tables
        function createNextTable(i) {
          if (i < schemas.length) {
            client.query(schemas[i], function(err) {
              if (err) {
                logUnexpectedError(err);
                cb(err);
              } else {
                createNextTable(i+1);
              }
            });
          } else {
            cb();
          }
        }
        createNextTable(0);
      });
    });
  };
};

exports.close = function(cb) {
  function endConn() {
    client.end(function(err) {
      client = undefined;
      if (err) logUnexpectedError(err);
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
    function(err, rows) {
      if (err) logUnexpectedError(err);
      cb(rows && rows.length > 0 && rows[0].N > 0);
    }
  );
}

exports.isStaged = function(email, cb) {
  client.query(
    "SELECT COUNT(*) as N FROM staged WHERE email = ?", [ email ],
    function(err, rows) {
      if (err) logUnexpectedError(err);
      cb(rows && rows.length > 0 && rows[0].N > 0);
    }
  );
}

exports.stageUser = function(email, cb) {
  var secret = secrets.generate(48);
  // overwrite previously staged users
  client.query('INSERT INTO staged (secret, new_acct, email) VALUES(?,TRUE,?) ' +
               'ON DUPLICATE KEY UPDATE secret=?, existing="", new_acct=TRUE',
               [ secret, email, secret],
               function(err) {
                 if (err) {
                   logUnexpectedError(err);
                   cb(undefined, err);
                 } else cb(secret);
               });
}

exports.emailForVerificationSecret = function(secret, cb) {
  client.query(
    "SELECT email FROM staged WHERE secret = ?", [ secret ],
    function(err, rows) {
      if (err) logUnexpectedError(err);
      cb((rows && rows.length > 0) ? rows[0].email : undefined);
    });
};

exports.gotVerificationSecret = function(secret, hash, cb) {
  client.query(
    "SELECT * FROM staged WHERE secret = ?", [ secret ],
    function(err, rows) {
      if (err) {
        logUnexpectedError(err);
        cb(err);
      } else if (rows.length === 0) cb("unknown secret");
      else {
        var o = rows[0];

        function addEmailToUser(userID) {
          // issue #170 - delete any old records with the same
          // email address.  this is necessary because
          // gotVerificationSecret is invoked both for
          // forgotten password flows and for new user signups.
          // We could add an `ON DUPLICATE KEY` clause, however
          // We actually want to invalidate all old public keys.
          client.query(
            "DELETE FROM email WHERE address = ?",
            [ o.email ],
            function(err, info) {
              if (err) { logUnexpectedError(err); cb(err); return; }
              else {
                client.query(
                  "INSERT INTO email(user, address) VALUES(?, ?)",
                  [ userID, o.email ],
                  function(err, info) {
                    if (err) logUnexpectedError(err);
                    cb(err ? err : undefined, o.email);
                  });
              }
            });
        }

        // delete the record
        client.query("DELETE LOW_PRIORITY FROM staged WHERE secret = ?", [ secret ]);

        if (o.new_acct) {
          // we're creating a new account, add appropriate entries into user and email tables.
          client.query(
            "INSERT INTO user(passwd) VALUES(?)",
            [ hash ],
            function(err, info) {
              if (err) { logUnexpectedError(err); cb(err); return; }
              addEmailToUser(info.insertId);
            });
        } else {
          // we're adding an email address to an existing user account.  add appropriate entries into
          // email table
          client.query(
            "SELECT user FROM email WHERE address = ?", [ o.existing ],
            function(err, rows) {
              if (err) { logUnexpectedError(err); cb(err); }
              else if (rows.length === 0) cb("cannot find email address: " + o.existing);
              else {
                addEmailToUser(rows[0].user);
              }
            });
        }
      }
    }
  );
}

exports.emailsBelongToSameAccount = function(lhs, rhs, cb) {
  client.query(
    'SELECT COUNT(*) AS n FROM email WHERE address = ? AND user = ( SELECT user FROM email WHERE address = ? );',
    [ lhs, rhs ],
    function (err, rows) {
      if (err) cb(false);
      else cb(rows.length === 1 && rows[0].n === 1);
    });
}

exports.stageEmail = function(existing_email, new_email, cb) {
  var secret = secrets.generate(48);
  // overwrite previously staged users
  client.query('INSERT INTO staged (secret, new_acct, existing, email) VALUES(?,FALSE,?,?) ' +
               'ON DUPLICATE KEY UPDATE secret=?, existing=?, new_acct=FALSE',
               [ secret, existing_email, new_email, secret, existing_email],
               function(err) {
                 if (err) {
                   logUnexpectedError(err);
                   cb(undefined, err);
                 }
                 else cb(secret);
               });
}

exports.checkAuth = function(email, cb) {
  client.query(
    'SELECT passwd FROM user WHERE id = ( SELECT user FROM email WHERE address = ? )',
    [ email ],
    function (err, rows) {
      if (err) logUnexpectedError(err);
      cb((rows && rows.length == 1) ? rows[0].passwd : undefined);
    });
}

exports.updatePassword = function(email, hash, cb) {
  client.query(
    'UPDATE user SET passwd = ? WHERE id = ( SELECT user FROM email WHERE address = ? )',
    [ hash, email ],
    function (err, rows) {
      if (err) logUnexpectedError(err);
      cb((err || rows.affectedRows !== 1) ? ("no record with email " + email) : undefined);
    });
}

/*
 * list the user's emails.
 *
 * returns an object keyed by email address with properties for each email.
 */
exports.listEmails = function(email, cb) {
  client.query(
    'SELECT address FROM email WHERE user = ( SELECT user FROM email WHERE address = ? ) ',
      [ email ],
      function (err, rows) {
        if (err) cb(err);
        else {
          var emails = {};

          // eventually we'll have fields in here
          for (var i = 0; i < rows.length; i++)
            emails[rows[i].address] = {};

          cb(null,emails);
        }
      });
};

exports.removeEmail = function(authenticated_email, email, cb) {
  exports.emailsBelongToSameAccount(authenticated_email, email, function(ok) {
    if (!ok) {
      logger.warn(authenticated_email + ' attempted to delete an email that doesn\'t belong to her: ' + email);
      cb("authenticated user doesn't have permission to remove specified email " + email);
      return;
    }

    client.query(
      'DELETE FROM email WHERE address = ?',
      [ email ],
      function(err, info) {
        if (err) logUnexpectedError(err);
        // smash null into undefined
        cb(err ? err : undefined);
      });
  });
}

exports.cancelAccount = function(email, cb) {
  function reportErr(err) { if (err) logUnexpectedError(err); }
  client.query(
    "SELECT user FROM email WHERE address = ?", [ email ],
    function (err, rows) {
      if (err) {
        logUnexpectedError(err)
        return cb(err);
      } else if (!rows || !rows.length === 1 || typeof rows[0] !== 'object') {
        var e = "no user with given account: " + email ;
        logUnexpectedError(e)
        return cb(e);
      }
      var uid = rows[0].user;
      client.query("DELETE LOW_PRIORITY FROM email WHERE user = ?", [ uid ], reportErr);
      client.query("DELETE LOW_PRIORITY FROM user WHERE id = ?", [ uid ], reportErr);
      cb();
    });
}
