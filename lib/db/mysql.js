/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This is a mysql driver for the browserid server.  It maps the data
 * storage requirements of browserid onto a relational schema.  This
 * driver is intended to be fast and scalable.
 */

/*
 * The Schema:
 *
 *    +--- user ------+       +--- email -----+
 *    |*int id        | <-\   |*int id        |
 *    | string passwd |    \- |*int user      |
 *    +---------------+       |*string address|
 *                            | enum type     |
 *                            +---------------+
 *
 *
 *    +------ staged ----------+
 *    |*int id                 |
 *    |*string secret          |
 *    | bool new_acct          |
 *    | int existing_user      |
 *    |*string email           |
 *    | timestamp ts           |
 *    +------------------------+
 */

const
mysql = require('mysql'),
secrets = require('../secrets.js'),
logger = require('../logging.js').logger,
statsd = require('../statsd');

var client = undefined;

// If you change these schemas, please notify <services-ops@mozilla.com>
const schemas = [
  "CREATE TABLE IF NOT EXISTS user (" +
    "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
    "passwd CHAR(64)" +
    ") ENGINE=InnoDB;",

  "CREATE TABLE IF NOT EXISTS email (" +
    "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
    "user BIGINT NOT NULL," +
    "address VARCHAR(255) UNIQUE NOT NULL," +
    "type ENUM('secondary', 'primary') DEFAULT 'secondary' NOT NULL," +
    "FOREIGN KEY user_fkey (user) REFERENCES user(id)" +
    ") ENGINE=InnoDB;",

  "CREATE TABLE IF NOT EXISTS staged (" +
    "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
    "secret CHAR(48) UNIQUE NOT NULL," +
    "new_acct BOOL NOT NULL," +
    "existing_user BIGINT," +
    "email VARCHAR(255) UNIQUE NOT NULL," +
    "ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL," +
    "FOREIGN KEY existing_user_fkey (existing_user) REFERENCES user(id)" +
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

  // let's figure out the database name
  var database = cfg.database;
  if (!database) database = "browserid";

  // create the client
  function doConnect() {
    logger.debug("connecting to database: " + database);
    options.database = database;
    client = mysql.createClient(options);

    // replace .query with a function that times queries and
    // logs to statsd
    var realQuery = client.query;
    client.query = function() {
      var startTime = new Date();
      var client_cb;
      var new_cb = function() {
        var reqTime = new Date - startTime;
        statsd.timing('query_time', reqTime);
        if (client_cb) client_cb.apply(null, arguments);
      };
      var args = Array.prototype.slice.call(arguments);
      if (typeof args[args.length - 1] === 'function') {
        client_cb = args[args.length - 1];
        args[args.length - 1] = new_cb;
      } else {
        args.push(new_cb);
      }
      realQuery.apply(client, args);
    };

    client.ping(function(err) {
      logger.debug("connection to database " + (err ? ("fails: " + err) : "established"));
      cb(err);
    });
  }

  // now create the databse
  if (cfg.create_schema) {
    logger.debug("creating database and tables if required");
    var createClient = mysql.createClient(options);
    createClient.query("CREATE DATABASE IF NOT EXISTS " + database, function(err) {
      if (err) {
        logUnexpectedError(err);
        cb(err);
        return;
      }
      createClient.useDatabase(database, function(err) {
        if (err) {
          logUnexpectedError(err);
          cb(err);
          return;
        }

        // now create tables
        function createNextTable(i) {
          if (i < schemas.length) {
            createClient.query(schemas[i], function(err) {
              if (err) {
                logUnexpectedError(err);
                cb(err);
              } else {
                createNextTable(i+1);
              }
            });
          } else {
            createClient.end(function(err) {
              if (err) {
                logUnexpectedError(err);
                cb(err);
              } else {
                doConnect();
              }
            });
          }
        }
        createNextTable(0);
      });
    });
  } else {
    doConnect();
  }
};

exports.close = function(cb) {
  client.end(function(err) {
    client = undefined;
    if (err) logUnexpectedError(err);
    if (cb) cb(err);
  });
};

exports.closeAndRemove = function(cb) {
  var db_to_remove = client.database;

  // don't let this happen if the name of the database is 'browserid',
  // as a sanity check
  if (db_to_remove === 'browserid') {
    throw "dropping a database named 'browserid' is not allowed";
  }

  client.query("DROP DATABASE " + db_to_remove, function(err) {
    exports.close(cb);
  });
};

exports.emailKnown = function(email, cb) {
  client.query(
    "SELECT COUNT(*) as N FROM email WHERE address = ?", [ email ],
    function(err, rows) {
      if (err) logUnexpectedError(err);
      cb(rows && rows.length > 0 && rows[0].N > 0);
    }
  );
};

exports.userKnown = function(uid, cb) {
  client.query(
    "SELECT COUNT(*) as N FROM user WHERE id = ?", [ uid ],
    function(err, rows) {
      if (err) logUnexpectedError(err);
      cb(rows && rows.length > 0 && rows[0].N > 0);
    }
  );
};

exports.emailType = function(email, cb) {
  client.query(
    "SELECT type FROM email WHERE address = ?", [ email ],
    function(err, rows) {
      if (err) logUnexpectedError(err);
      cb((rows && rows.length > 0) ? rows[0].type : undefined);
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

exports.lastStaged = function(email, cb) {
  client.query(
    "SELECT UNIX_TIMESTAMP(ts) as ts FROM staged WHERE email = ?", [ email ],
    function(err, rows) {
      if (err) logUnexpectedError(err);
      if (!rows || rows.length === 0) cb();
      else cb(new Date(rows[0].ts * 1000));
    }
  );
};

exports.stageUser = function(email, cb) {
  secrets.generate(48, function(secret) {
    // overwrite previously staged users
    client.query('INSERT INTO staged (secret, new_acct, email) VALUES(?,TRUE,?) ' +
                 'ON DUPLICATE KEY UPDATE secret=?, existing_user=NULL, new_acct=TRUE, ts=NOW()',
                 [ secret, email, secret],
                 function(err) {
                   if (err) {
                     logUnexpectedError(err);
                     cb(undefined, err);
                   } else cb(secret);
                 });
  });
};


exports.haveVerificationSecret = function(secret, cb) {
  client.query(
    "SELECT count(*) as n FROM staged WHERE secret = ?", [ secret ],
    function(err, rows) {
      if (err) cb(false);
      else cb(rows.length === 1 && rows[0].n === 1);
    });
};

exports.emailForVerificationSecret = function(secret, cb) {
  client.query(
    "SELECT * FROM staged WHERE secret = ?", [ secret ],
    function(err, rows) {
      if (err) logUnexpectedError(err);
      // if the record was not found, fail out
      if (!rows || rows.length != 1) return cb("no such secret");

      var o = rows[0];

      // if the record was found and this is for a new_acct, return the email
      if (o.new_acct) return cb(undefined, { email: o.email, needs_password: false });

      // we need a userid.  the old schema had an 'existing' field which was an email
      // address.  the new schema has an 'existing_user' field which is a userid.
      // this is transitional code so outstanding verification links continue working
      // and can be removed in feb 2012 some time.  maybe for valentines day?
      if (typeof o.existing_user === 'number') doCheckAuth(o.existing_user);
      else if (typeof o.existing === 'string') {
        exports.emailToUID(o.existing, function(uid) {
          if (uid === undefined) return cb('acct associated with staged email doesn\'t exist');
          doCheckAuth(uid);
        });
      }

      function doCheckAuth(uid) {
        // if the account is being added to an existing account, let's find
        // out if the account has a password set (if only primary email addresses
        // are associated with the acct at the moment, then there will not be a
        // password set and the user will need to set one with the addition of
        // this addresss)
        exports.checkAuth(uid, function(hash) {
          cb(undefined, {
            email: o.email,
            needs_password: !hash
          });
        });
      }
    });
};

exports.verificationSecretForEmail = function(email, cb) {
  client.query(
    "SELECT secret FROM staged WHERE email = ?", [ email ],
    function(err, rows) {
      if (err) logUnexpectedError(err);
      cb((rows && rows.length > 0) ? rows[0].secret : undefined);
    });
};

function addEmailToUser(userID, email, type, cb) {
  // issue #170 - delete any old records with the same
  // email address.  this is necessary because
  // gotVerificationSecret is invoked both for
  // forgotten password flows and for new user signups.
  client.query(
    "DELETE FROM email WHERE address = ?",
    [ email ],
    function(err, info) {
      if (err) { logUnexpectedError(err); cb(err); return; }
      else {
        client.query(
          "INSERT INTO email(user, address, type) VALUES(?, ?, ?)",
          [ userID, email, type ],
          function(err, info) {
            if (err) logUnexpectedError(err);
            cb(err ? err : undefined, email, userID);
          });
      }
    });
}


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

        // delete the record
        client.query("DELETE LOW_PRIORITY FROM staged WHERE secret = ?", [ secret ]);

        if (o.new_acct) {
          // we're creating a new account, add appropriate entries into user and email tables.
          client.query(
            "INSERT INTO user(passwd) VALUES(?)",
            [ hash ],
            function(err, info) {
              if (err) { logUnexpectedError(err); cb(err); return; }
              addEmailToUser(info.insertId, o.email, 'secondary', cb);
            });
        } else {
          // we need a userid.  the old schema had an 'existing' field which was an email
          // address.  the new schema has an 'existing_user' field which is a userid.
          // this is transitional code so outstanding verification links continue working
          // and can be removed in feb 2012 some time.  maybe for valentines day?
          if (typeof o.existing_user === 'number') doAddEmail(o.existing_user);
          else if (typeof o.existing === 'string') {
            exports.emailToUID(o.existing, function(uid) {
              if (uid === undefined) return cb('acct associated with staged email doesn\'t exist');
              doAddEmail(uid);
            });
          }
          function doAddEmail(uid) {
            // we're adding an email address to an existing user account.  add appropriate entries into
            // email table
            addEmailToUser(uid, o.email, 'secondary', cb);
          }
        };
      }
    }
  );
}

exports.addPrimaryEmailToAccount = function(uid, emailToAdd, cb) {
  // we're adding an email address to an existing user account.  add appropriate entries into
  // email table
  addEmailToUser(uid, emailToAdd, 'primary', cb);
}

exports.createUserWithPrimaryEmail = function(email, cb) {
  // create a new user acct with no password
  client.query(
    "INSERT INTO user() VALUES()",
    function(err, info) {
      if (err) { logUnexpectedError(err); cb(err); return; }
      var uid = info.insertId;
      client.query(
        "INSERT INTO email(user, address, type) VALUES(?, ?, ?)",
        [ uid, email, 'primary' ],
        function(err, info) {
          if (err) logUnexpectedError(err);
          cb(err ? err : undefined, uid);
        });
    });
};

exports.emailsBelongToSameAccount = function(lhs, rhs, cb) {
  client.query(
    'SELECT COUNT(*) AS n FROM email WHERE address = ? AND user = ( SELECT user FROM email WHERE address = ? );',
    [ lhs, rhs ],
    function (err, rows) {
      if (err) cb(false);
      else cb(rows.length === 1 && rows[0].n === 1);
    });
}

exports.userOwnsEmail = function(uid, email, cb) {
  client.query(
    'SELECT COUNT(*) AS n FROM email WHERE address = ? AND user = ?',
    [ email, uid ],
    function (err, rows) {
      if (err) cb(false);
      else cb(rows.length === 1 && rows[0].n === 1);
    });
}

exports.stageEmail = function(existing_user, new_email, cb) {
  secrets.generate(48, function(secret) {
    // overwrite previously staged users
    client.query('INSERT INTO staged (secret, new_acct, existing_user, email) VALUES(?,FALSE,?,?) ' +
                 'ON DUPLICATE KEY UPDATE secret=?, existing_user=?, new_acct=FALSE, ts=NOW()',
                 [ secret, existing_user, new_email, secret, existing_user],
                 function(err) {
                   if (err) {
                     logUnexpectedError(err);
                     cb(undefined, err);
                   }
                   else cb(secret);
                 });
  });
};

exports.emailToUID = function(email, cb) {
  client.query(
    'SELECT user FROM email WHERE address = ?',
    [ email ],
    function (err, rows) {
      if (err) logUnexpectedError(err);
      cb((rows && rows.length == 1) ? rows[0].user : undefined);
    });
};

exports.checkAuth = function(uid, cb) {
  client.query(
    'SELECT passwd FROM user WHERE id = ?',
    [ uid ],
    function (err, rows) {
      if (err) logUnexpectedError(err);
      cb((rows && rows.length == 1) ? rows[0].passwd : undefined);
    });
}

exports.updatePassword = function(uid, hash, cb) {
  client.query(
    'UPDATE user SET passwd = ? WHERE id = ?',
    [ hash, uid ],
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
exports.listEmails = function(uid, cb) {
  client.query(
    'SELECT address, type FROM email WHERE user = ?',
      [ uid ],
      function (err, rows) {
        if (err) cb(err);
        else {
          var emails = {};

          // eventually we'll have fields in here
          for (var i = 0; i < rows.length; i++)
            emails[rows[i].address] = {
              type: rows[i].type
            };

          cb(null,emails);
        }
      });
};

exports.removeEmail = function(authenticated_user, email, cb) {
  exports.userOwnsEmail(authenticated_user, email, function(ok) {
    if (!ok) {
      logger.warn(authenticated_user + ' attempted to delete an email that doesn\'t belong to her: ' + email);
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
};

exports.cancelAccount = function(uid, cb) {
  function reportErr(err) { if (err) logUnexpectedError(err); }
  client.query("DELETE LOW_PRIORITY FROM email WHERE user = ?", [ uid ], reportErr);
  client.query("DELETE LOW_PRIORITY FROM user WHERE id = ?", [ uid ], reportErr);
  process.nextTick(cb);
};

exports.addTestUser = function(email, hash, cb) {
  client.query(
    "INSERT INTO user(passwd) VALUES(?)",
    [ hash ],
    function(err, info) {
      if (err) {
        logUnexpectedError(err);
        cb(err);
        return;
      }
      client.query(
        "INSERT INTO email(user, address) VALUES(?, ?)",
        [ info.insertId, email ],
        function(err, info) {
          if (err) logUnexpectedError(err);
          cb(err ? err : undefined, email);
        });
    });
};

exports.ping = function(cb) {
  client.ping(function(err) {
    cb(err);
  });
};
