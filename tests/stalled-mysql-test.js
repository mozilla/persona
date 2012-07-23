#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

if (process.env['NODE_ENV'] != 'test_mysql') process.exit(0);

const assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
temp = require('temp'),
fs = require('fs'),
jwcrypto = require('jwcrypto'),
path = require('path');

var suite = vows.describe('forgotten-email');

require("jwcrypto/lib/algs/ds");
require("jwcrypto/lib/algs/rs");

// disable vows (often flakey?) async error behavior
suite.options.error = false;

// let's reduce the amount of time allowed for queries, so that
// we get a faster failure and tests run quicker
process.env['MAX_QUERY_TIME_MS'] = 250;

// and let's instruct children to pretend as if the driver is
// stalled if a file exists
var stallFile = temp.path({suffix: '.stall'});
process.env['STALL_MYSQL_WHEN_PRESENT'] = stallFile;

start_stop.addStartupBatches(suite);

// ever time a new token is sent out, let's update the global
// var 'token'
var token = undefined;

function addStallDriverBatch(stall) {
  suite.addBatch({
    "changing driver state": {
      topic: function() {
        if (stall) fs.writeFileSync(stallFile, "");
        else fs.unlinkSync(stallFile);

        // After changing the file which indicates to child
        // processes whether the driver should simulate a stalled
        // state or not, we need to wait for them to detect the
        // change.  because we use `fs.watchFile()` on a short poll,
        // this should be nearly instantaneous.  300ms is a magic number
        // which is hoped to allow plenty of time even on a loaded
        // machine
        setTimeout(this.callback, 300);
      },
      "completes": function(err, r) { }
    }
  });
}

// first stall mysql
addStallDriverBatch(true);

// call session context once to populate CSRF stuff in the
// wsapi client lib
suite.addBatch({
  "get context": {
    topic: wsapi.get('/wsapi/session_context'),
    "works" : function(err, r) {
      assert.isNull(err);
    }
  }
});

// now try all apis that can be excercised without further setup
suite.addBatch({
  "ping": {
    topic: wsapi.get('/wsapi/ping', {}),
    "fails with 500 when db is stalled": function(err, r) {
      // address info with a primary address doesn't need db access.
      assert.strictEqual(r.code, 500);
    }
  },
  "address_info": {
    topic: wsapi.get('/wsapi/address_info', {
      email: 'test@example.domain'
    }),
    "works": function(err, r) {
      // address info with a primary address doesn't need db access.
      assert.strictEqual(r.code, 200);
    }
  },
  "address_info": {
    topic: wsapi.get('/wsapi/address_info', {
      email: 'test@non-existant.domain'
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "have_email": {
    topic: wsapi.get('/wsapi/have_email', {
      email: 'test@example.com'
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "authenticate_user": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: 'test@example.com',
      pass: 'oogabooga',
      ephemeral: false
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "complete_email_confirmation": {
    topic: wsapi.post('/wsapi/complete_email_confirmation', {
      token: 'bogusbogusbogusbogusbogusbogusbogusbogusbogusbog'
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "complete_user_creation": {
    topic: wsapi.post('/wsapi/complete_user_creation', {
      token: 'bogusbogusbogusbogusbogusbogusbogusbogusbogusbog',
      pass: 'alsobogus'
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "email_for_token": {
    topic: wsapi.get('/wsapi/email_for_token', {
      token: 'bogusbogusbogusbogusbogusbogusbogusbogusbogusbog'
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "stage_user": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'bogus@bogus.edu',
      pass: 'a_password',
      site: 'https://whatev.er'
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  }
});

// now unstall the driver, we'll create an account and sign in in
// order to test the behavior of the remaining APIs when the database
// is stalled
addStallDriverBatch(false);

var token = undefined;

suite.addBatch({
  "ping": {
    topic: wsapi.get('/wsapi/ping', {}),
    "works when database is unstalled": function(err, r) {
      // address info with a primary address doesn't need db access.
      assert.strictEqual(r.code, 200);
    }
  }
});

suite.addBatch({
  "account staging": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: "stalltest@whatev.er",
      pass: 'a_password',
      site: 'http://fakesite.com'
    }),
    "works":     function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "a token": {
    topic: function() {
      start_stop.waitForToken(this.callback);
    },
    "is obtained": function (t) {
      assert.strictEqual(typeof t, 'string');
    },
    "setting password": {
      topic: function(token) {
        wsapi.post('/wsapi/complete_user_creation', {
          token: token
        }).call(this);
      },
      "works just fine": function(err, r) {
        assert.equal(r.code, 200);
      }
    }
  }
});

// re-stall mysql
addStallDriverBatch(true);

// test remaining wsapis

suite.addBatch({
  "ping": {
    topic: wsapi.get('/wsapi/ping', { }),
    "fails": function(err, r) {
      assert.strictEqual(r.code, 500);
    }
  },

  "account_cancel": {
    topic: wsapi.post('/wsapi/account_cancel', { }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "cert_key": {
    topic: wsapi.post('/wsapi/cert_key', {
      email: "test@whatev.er",
      pubkey: JSON.stringify("bogusbogusbogusbogusbogusbogusbogusbogusbogusbogusbogus"),
      ephemeral: false
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "email_addition_status": {
    topic: wsapi.get('/wsapi/email_addition_status', {
      email: "test@whatev.er"
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "list_emails": {
    topic: wsapi.get('/wsapi/list_emails', {}),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "remove_email": {
    topic: wsapi.post('/wsapi/remove_email', {
      email: "test@whatev.er"
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "session_context": {
    topic: wsapi.get('/wsapi/session_context', { }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "stage_email": {
    topic: wsapi.post('/wsapi/stage_email', {
      email: "test2@whatev.er",
      pass: 'a_password',
      site: "https://foo.com"
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "update_password": {
    topic: wsapi.post('/wsapi/update_password', {
      oldpass: "oldpassword",
      newpass: "newpassword"
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "user_creation_status": {
    topic: wsapi.get('/wsapi/user_creation_status', {
      email: "test3@whatev.er"
    }),
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  }
});

// now let's test apis that require an assertion, and only after verifying
// that, hit the database
const TEST_DOMAIN = 'example.domain',
      TEST_EMAIL = 'testuser@' + TEST_DOMAIN,
      TEST_ORIGIN = 'http://127.0.0.1:10002',
      TEST_FIRST_ACCT = 'testuser@fake.domain';

var g_keypair, g_cert, g_assertion;

suite.addBatch({
  "generating a keypair": {
    topic: function() {
      jwcrypto.generateKeypair({algorithm: "DS", keysize:256}, this.callback);
    },
    "succeeds": function(err, r) {
      assert.isObject(r);
      assert.isObject(r.publicKey);
      assert.isObject(r.secretKey);
      g_keypair = r;
    }
  }
});

var g_privKey = jwcrypto.loadSecretKey(
  require('fs').readFileSync(
    path.join(__dirname, '..', 'example', 'primary', 'sample.privatekey')));


suite.addBatch({
  "generting a certificate": {
    topic: function() {
      var domain = process.env['SHIMMED_DOMAIN'];

      var expiration = new Date();
      expiration.setTime(new Date().valueOf() + 60 * 60 * 1000);
      jwcrypto.cert.sign(g_keypair.publicKey, {email: TEST_EMAIL},
                        {expiresAt: expiration, issuedAt: new Date(), issuer: TEST_DOMAIN},
                         null, g_privKey, this.callback);
    },
    "works swimmingly": function(err, cert) {
      g_cert = cert;
      assert.isString(cert);
      assert.lengthOf(cert.split('.'), 3);
    }
  }
});

suite.addBatch({
  "generating an assertion": {
    topic: function() {
      var self = this;
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                              g_keypair.secretKey, function(err, assertion) {
                                self.callback(err,
                                              err ? undefined : jwcrypto.cert.bundle([g_cert], assertion));
                              });
    },
    "succeeds": function(err, r) {
      assert.isNull(err);
      assert.isString(r);
      g_assertion = r;
    }
  }
});

// finally!  we have our assertion in g_assertion
suite.addBatch({
  "add_email_with_assertion": {
    topic: function() {
      wsapi.post('/wsapi/add_email_with_assertion', {
        assertion: g_assertion
      }).call(this);
    },
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "auth_with_assertion": {
    topic: function() {
      wsapi.post('/wsapi/auth_with_assertion', {
        assertion: g_assertion,
        ephemeral: true
      }).call(this);
    },
    "fails with 503": function(err, r) {
      assert.strictEqual(r.code, 503);
    }
  },
  "create_account_with_assertion": {
    topic: function() {
      wsapi.post('/wsapi/create_account_with_assertion', {
        assertion: g_assertion
      }).call(this);
    },
    "fails with 404": function(err, r) {
      assert.strictEqual(r.code, 404);
    }
  }
});

// logout doesn't need database, it should still succeed
suite.addBatch({
  "logout": {
    topic: wsapi.post('/wsapi/logout', { }),
    "succeeds": function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  }
});

// finally, unblock mysql so we can shut down
addStallDriverBatch(false);

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
