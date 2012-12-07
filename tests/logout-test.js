#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const
assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
secondary = require('./lib/secondary.js'),
wsapi = require('./lib/wsapi.js'),
db = require('../lib/db.js'),
config = require('../lib/configuration.js'),
secrets = require('../lib/secrets.js');

var suite = vows.describe('logout');
var bid_cookie;

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const
TEST_EMAIL = secrets.weakGenerate(12) + '@somedomain.com',
TEST_PASS = 'thisismypassword',
TEST_SITE = 'http://fakesite.com';

// Note: this not-logged-in request will be rejected by middleware and will
// not actually reach lib/wsapi/logout.js code.
suite.addBatch({
  "POST /wsapi/logout when not authenticated": {
    topic: wsapi.post('/wsapi/logout', {}),
    "is rejected with response code 400": function (err, r) {
      assert.isNull(err);
      assert.strictEqual(r.code, 400);
    },
  },
});

// now create a new secondary account
suite.addBatch({
  "creating a secondary account": {
    topic: function() {
      secondary.create({
        email: TEST_EMAIL,
        pass:  TEST_PASS,
        site:  TEST_SITE,
      }, this.callback);
    },
    "succeeds": function(err) {
      assert.isNull(err);
    }
  }
});

// call /wsapi/session_context directly to see if the session is interpreted
// as authenticated.
suite.addBatch({
  "the test user": {
    topic: wsapi.get('/wsapi/session_context'),
    "is considered to be authenticated after login": function(err, r) {
      assert.strictEqual(r.code, 200);
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.authenticated, true);
      // Save the current state cookie to check later.
      bid_cookie = wsapi.getCookie(/^browserid_state/);
    }
  }
});

suite.addBatch({
  "POST /wsapi/logout": {
    topic: wsapi.post('/wsapi/logout', {}),
    "is handled correctly": function (err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.headers['content-type'].indexOf('application/json'), 0);
      assert.strictEqual(JSON.parse(r.body).success, true);
      // was a new cookie issued
      var cookie = wsapi.getCookie(/^browserid_state/);
      // terrible name for '!=='; should be strictNotEqual
      assert.notStrictEqual(cookie, bid_cookie);
    },
  },
});

suite.addBatch({
  "the test user": {
    topic: wsapi.get('/wsapi/session_context'),
    "is not considered to be authenticated after logout": function(err, r) {
      assert.strictEqual(r.code, 200);
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.authenticated, false);
    }
  }
});

suite.addBatch({
  "but the test user": {
    topic: wsapi.get('/wsapi/address_info', {
        email: TEST_EMAIL,
    }),
    "is still known after logout": function(err, r) {
      assert.strictEqual(r.code, 200);
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.type, "secondary");
      assert.strictEqual(resp.state, "known");
      assert.strictEqual(resp.disabled, false);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
