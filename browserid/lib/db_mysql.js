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
 *    +--- user ------+       +--- email ----+        +--- pubkey -----+
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
 *    |*string email           |
 *    | string pubkey          |
 *    | string passwd          |
 *    | timestamp ts           |
 *    +------------------------+
 */

const
mysql = require('mysql'),
secrets = require('./secrets'),
logger = require('../../libs/logging.js');

var client = undefined;

// may get defined at open() time causing a database to be dropped upon connection closing.
var drop_on_close = undefined;

const schemas = [
  "CREATE TABLE IF NOT EXISTS user   ( id INTEGER AUTO_INCREMENT PRIMARY KEY, passwd VARCHAR(64) );",
  "CREATE TABLE IF NOT EXISTS email  ( id INTEGER AUTO_INCREMENT PRIMARY KEY, user INTEGER, address VARCHAR(255) UNIQUE, INDEX(address) );",
  "CREATE TABLE IF NOT EXISTS pubkey ( id INTEGER AUTO_INCREMENT PRIMARY KEY, email INTEGER, content TEXT, expiry DATETIME );",
  "CREATE TABLE IF NOT EXISTS staged ( secret VARCHAR(48) PRIMARY KEY, new_acct BOOL, existing VARCHAR(255), email VARCHAR(255) UNIQUE, INDEX(email), pubkey TEXT, passwd VARCHAR(64), ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
];

// log an unexpected database error
function logUnexpectedError(detail) {
  // first, get line number of callee
  var where;
  try { dne; } catch (e) { where = e.stack.split('\n')[2].trim(); };
  // now log it!
  logger.log('db', { type: "unexpected", message: "unexpected database failure", detail: detail, where: where });
}

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
    client[param] = cfg[param] ? cfg[param] : defParams[param];
  });

  // let's figure out the database name
  var database = cfg.database;
  if (!database) database = "browserid";
  if (cfg.unit_test) {
    database += "_" + secrets.generate(8);
    drop_on_close = database;
  }

  // now create the databse
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

exports.stageUser = function(obj, cb) {
  var secret = secrets.generate(48);
  // overwrite previously staged users
  client.query('INSERT INTO staged (secret, new_acct, email, pubkey, passwd) VALUES(?,TRUE,?,?,?) ' +
               'ON DUPLICATE KEY UPDATE secret=?, existing="", new_acct=TRUE, pubkey=?, passwd=?',
               [ secret, obj.email, obj.pubkey, obj.hash, secret, obj.pubkey, obj.hash],
               function(err) {
                 if (err) {
                   logUnexpectedError(err);
                   cb(undefined, err);
                 } else cb(secret);
               });
}

exports.gotVerificationSecret = function(secret, cb) {
  client.query(
    "SELECT * FROM staged WHERE secret = ?", [ secret ],
    function(err, rows) {
      if (err) {
        logUnexpectedError(err);
        cb(err);
      } else if (rows.length === 0) cb("unknown secret");
      else {
        var o = rows[0];

        function addEmailAndPubkey(userID) {
          client.query(
            "INSERT INTO email(user, address) VALUES(?, ?)",
            [ userID, o.email ],
            function(err, info) {
              if (err) { logUnexpectedError(err); cb(err); return; }
              addKeyToEmailRecord(info.insertId, o.pubkey, cb);
            });
        }

        // delete the record
        client.query("DELETE LOW_PRIORITY FROM staged WHERE secret = ?", [ secret ]);

        if (o.new_acct) {
          // we're creating a new account, add appropriate entries into user, email, and pubkey.
          client.query(
            "INSERT INTO user(passwd) VALUES(?)",
            [ o.passwd ],
            function(err, info) {
              if (err) { logUnexpectedError(err); cb(err); return; }
              addEmailAndPubkey(info.insertId);
            });
        } else {
          // we're adding an email address to an existing user account.  add appropriate entries into email and
          // pubkey
          client.query(
            "SELECT user FROM email WHERE address = ?", [ o.existing ],
            function(err, rows) {
              if (err) { logUnexpectedError(err); cb(err); }
              else if (rows.length === 0) cb("cannot find email address: " + o.existing);
              else {
                addEmailAndPubkey(rows[0].user);
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

function addKeyToEmailRecord(emailId, pubkey, cb) {
  client.query(
    // XXX: 2 weeks is wrong, but then so is keypairs.
    "INSERT INTO pubkey(email, content, expiry) VALUES(?, ?, DATE_ADD(NOW(), INTERVAL 2 WEEK))",
    [ emailId, pubkey ],
    function(err, info) {
      if (err) logUnexpectedError(err);
      // smash null into undefined.
      cb(err ? err : undefined);
    });
}

exports.addKeyToEmail = function(existing_email, email, pubkey, cb) {
  // this function will NOT add a new email address to a user record.  The only
  // way that happens is when a verification secret is provided to us.  Limiting
  // the code paths that result in us concluding that a user owns an email address
  // is a Good Thing.
  exports.emailsBelongToSameAccount(existing_email, email, function(ok) {
    if (!ok) {
      cb("authenticated user doesn't have permission to add a public key to " + email);
      return;
    }

    // now we know that the user has permission to add a key.
    client.query(
      "SELECT id FROM email WHERE address = ?", [ email ],
      function(err, rows) {
        if (err) { logUnexpectedError(err); cb(err); }
        else if (rows.length === 0) cb("cannot find email address: " + email);
        else {
          addKeyToEmailRecord(rows[0].id, pubkey, cb);
        }
      });
  });
}

exports.stageEmail = function(existing_email, new_email, pubkey, cb) {
  var secret = secrets.generate(48);
  // overwrite previously staged users
  client.query('INSERT INTO staged (secret, new_acct, existing, email, pubkey) VALUES(?,FALSE,?,?,?) ' +
               'ON DUPLICATE KEY UPDATE secret=?, existing=?, new_acct=FALSE, pubkey=?, passwd=""',
               [ secret, existing_email, new_email, pubkey, secret, existing_email, pubkey],
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

function emailHasPubkey(email, pubkey, cb) {
  client.query(
    'SELECT pubkey.content FROM pubkey, email WHERE email.address = ? AND pubkey.email = email.id AND pubkey.content = ?',
    [ email, pubkey ],
    function(err, rows) {
      if (err) logUnexpectedError(err);
      cb(rows && rows.length === 1);
    });
}

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

  client.query(
    'SELECT address FROM email WHERE user = ( SELECT user FROM email WHERE address = ? ) ',
      [ email ],
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
};


exports.pubkeysForEmail = function(email, cb) {
  client.query(
    'SELECT content FROM pubkey WHERE email = (SELECT id FROM email WHERE address = ?)',
    [ email ],
    function (err, rows) {
      var ar = [ ];
      if (!err) rows.forEach(function(r) { ar.push(r.content); });
      else logUnexpectedError(err);
      cb(ar);
    });
}

exports.removeEmail = function(authenticated_email, email, cb) {
  exports.emailsBelongToSameAccount(authenticated_email, email, function(ok) {
    if (!ok) {
      logger.log('security', authenticated_email + ' attempted to delete an email that doesn\'t belong to her: ' + email);
      cb("authenticated user doesn't have permission to remove specified email " + email);
      return;
    }

    client.query(
      'DELETE FROM pubkey WHERE email = ( SELECT id FROM email WHERE address = ? )',
      [ email ],
      function (err, info) {
        if (err) {
          logUnexpectedError(err);
          cb(err);
        } else {
          client.query(
            'DELETE FROM email WHERE address = ?',
            [ email ],
            function(err, info) {
              if (err) logUnexpectedError(err);
              // smash null into undefined
              cb(err ? err : undefined);
            });
        }
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
        cb(err);
        return
      }
      var uid = rows[0].user;
      client.query("DELETE LOW_PRIORITY FROM pubkey WHERE email in ( SELECT id FROM email WHERE user = ? )", [ uid ], reportErr);
      client.query("DELETE LOW_PRIORITY FROM email WHERE user = ?", [ uid ], reportErr);
      client.query("DELETE LOW_PRIORITY FROM user WHERE id = ?", [ uid ], reportErr);
      cb();
    });
}
