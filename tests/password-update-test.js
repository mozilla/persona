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

const TEST_EMAIL = 'someuser@somedomain.com',
      OLD_PASSWORD = 'thisismyoldpassword',
      NEW_PASSWORD = 'thisismynewpassword';

// surpress console output of emails with a noop email interceptor
var token = undefined;

// first stage the account
suite.addBatch({
  "account staging": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD,
      site: 'https://fakesite.com:123'
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
        token: token,
        pass: OLD_PASSWORD
      }).call(this);
    },
    "works just fine": function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "authenticating with the password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD,
      ephemeral: false
    }),
    "works as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  },
  "authenticating with the wrong password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: NEW_PASSWORD,
      ephemeral: false
    }),
    "fails as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  }
});

suite.addBatch({
  "updating the password without specifying a proper old password": {
    topic: wsapi.post('/wsapi/update_password', {
      oldpass: "bogus ass password",
      newpass: NEW_PASSWORD
    }),
    "fails as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  }
});

suite.addBatch({
  "updating the password with a bogus new password": {
    topic: wsapi.post('/wsapi/update_password', {
      oldpass: OLD_PASSWORD,
      newpass: 'bogus' // too short
    }),
    "fails as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  }
});

suite.addBatch({
  "updating the password": {
    topic: wsapi.post('/wsapi/update_password', {
      oldpass: OLD_PASSWORD,
      newpass: NEW_PASSWORD
    }),
    "works as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

suite.addBatch({
  "authenticating with the password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: NEW_PASSWORD,
      ephemeral: false
    }),
    "works as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  },
  "authenticating with the wrong password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD,
      ephemeral: false
    }),
    "fails as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
