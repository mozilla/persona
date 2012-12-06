#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

// this test is for issue 2822 - it tests that when an email is re-staged
// the password hash is updated.

// disable email throttling so we can stage the same email twice without delay
process.env['MIN_TIME_BETWEEN_EMAILS_MS'] = 0;

const
assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js');

var suite = vows.describe('double-stage-updates-password');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const EMAIL = 'test@example.com',
       SITE = 'http://rp.example.com';

var token;

// stage with password 1
suite.addBatch({
  "staging an account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: EMAIL,
      pass: 'password1',
      site: SITE
    }),
    "succeeds": function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "yields": {
      topic: function() {
        start_stop.waitForToken(this.callback);
      },
      "a verification token": function (t) {
        assert.strictEqual(typeof t, 'string');
        token = t;
      }
    }
  }
});

// now stage again with password 2
suite.addBatch({
  "staging an account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: EMAIL,
      pass: 'password2',
      site: SITE
    }),
    "succeeds": function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "yields": {
      topic: function() {
        start_stop.waitForToken(this.callback);
      },
      "a verification token": function (t) {
        assert.strictEqual(typeof t, 'string');
        token = t;
      }
    }
  }
});

// verify with the most recent token (associated with password2)
suite.addBatch({
  "verifying account ownership": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', { token: token }).call(this);
    },
    "works": function(err, r) {
      assert.equal(r.code, 200);
      assert.strictEqual(true, JSON.parse(r.body).success);
    }
  }
});

// test that password2 works
suite.addBatch({
  "first password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: EMAIL,
      pass: 'password1',
      ephemeral: false
    }),
    "fails": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  },
  "second password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: EMAIL,
      pass: 'password2',
      ephemeral: false
    }),
    "succeeds": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
