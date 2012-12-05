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
config = require('../lib/configuration.js'),
secondary = require('./lib/secondary.js');

var suite = vows.describe('session-prolong');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_EMAIL = 'someuser@somedomain.com',
      PASSWORD = 'thisismypassword';

// create a new secondary account
suite.addBatch({
  "creating a secondary account": {
    topic: function() {
      secondary.create({
        email: TEST_EMAIL,
        pass: PASSWORD,
        site: 'http://fakesite.com'
      }, this.callback);
    }, 
    "succeeds": function(err, r) {
      assert.isNull(err);
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
