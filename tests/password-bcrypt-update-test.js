#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
db = require('../lib/db.js'),
config = require('../lib/configuration.js'),
bcrypt = require('bcrypt');

var suite = vows.describe('password-length');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_EMAIL = 'update@passwd.bcrypt',
      TEST_PASSWORD = 'thisismypassword';

// surpress console output of emails with a noop email interceptor
var token = undefined;

suite.addBatch({
  "get csrf token": {
    topic: wsapi.get('/wsapi/session_context'),
    "works": function (err, r) {
      assert.equal(typeof r.body, 'string');
      var v = JSON.parse(r.body);
      assert.equal(typeof v, 'object');
      assert.equal(typeof v.csrf_token, 'string');
      assert.equal(typeof v.server_time, 'number');
    }
  }
});

// first stage the account
suite.addBatch({
  "account staging": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: TEST_EMAIL,
      pass: TEST_PASSWORD,
      site:'https://fakesite.com'
    }),
    "works":     function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});

// wait for the token
suite.addBatch({
  "a token": {
    topic: function() {
      start_stop.waitForToken(this.callback);
    },
    "is obtained": function (t) {
      assert.strictEqual(typeof t, 'string');
      token = t;
    }
  }
});

// create a new account via the api with (first address)
suite.addBatch({
  "setting password": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', {
        token: token
      }).call(this);
    },
    "works just fine": function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});

// check the rounds on the password
suite.addBatch({
  "the password": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID(TEST_EMAIL, function(err, uid) {
        db.checkAuth(uid, cb);
      });
    },
    "is bcrypted with the expected number of rounds": function(err, r) {
      assert.isNull(err);
      assert.equal(typeof r, 'string');
      assert.equal(config.get('bcrypt_work_factor'), bcrypt.get_rounds(r));
    }
  }
});

// now change the configuration to bcrypt at 8 rounds
suite.addBatch({
  "updating work factor": {
    topic: function() {
      process.env['BCRYPT_WORK_FACTOR'] = 8;
      return true;
    },
    "succeeds": function() {}
  }
});

start_stop.addRestartBatch(suite);

// at authentication time we should see the password get updated
suite.addBatch({
  "re-authentication": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: TEST_PASSWORD,
      ephemeral: false
    }),
    "should work": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

// let's wait a little while for the password update to complete.
// sleeps suck, but 8 rounds should reliably complete in under 2s
suite.addBatch({
  "after a bit of waiting": {
    topic: function() {
      setTimeout(this.callback, 2000);
    },
    "if we recheck the auth hash": {
      topic: function() {
        var cb = this.callback;
        db.emailToUID(TEST_EMAIL, function(err, uid) {
          db.checkAuth(uid, cb);
        });
      },
      "its bcrypted with 8 rounds": function(err, r) {
        assert.isNull(err);
        assert.equal(typeof r, 'string');
        assert.equal(8, bcrypt.get_rounds(r));
      }
    }
  }
});

// at authentication time we should see the password get updated
suite.addBatch({
  "and re-authentication": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: TEST_PASSWORD,
      ephemeral: false
    }),
    "should still work": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
