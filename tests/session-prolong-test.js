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

var suite = vows.describe('session-prolong');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_EMAIL = 'someuser@somedomain.com',
      PASSWORD = 'thisismypassword';

var token = undefined;

// first stage the account
suite.addBatch({
  "account staging": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: TEST_EMAIL,
      pass: PASSWORD,
      site: 'http://fakesite.com'
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

suite.addBatch({
  "authenticating with the password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: PASSWORD,
      ephemeral: true
    }),
    "works as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

suite.addBatch({
  "session length": {
    topic: function() {
      this.callback(wsapi.getCookie(/^browserid_state/));
    },
    "is short (ephemeral)": function(cookie) {
      assert.equal(cookie.split('.')[3], config.get('ephemeral_session_duration_ms'));
    }
  }
});

suite.addBatch({
  "session prolonging": {
    topic: wsapi.post('/wsapi/prolong_session', {}),
    "returns 200": function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  }
});

suite.addBatch({
  "session length": {
    topic: function() {
      this.callback(wsapi.getCookie(/^browserid_state/));
    },
    "becomes long": function(cookie) {
      assert.equal(cookie.split('.')[3], config.get('authentication_duration_ms'));
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
