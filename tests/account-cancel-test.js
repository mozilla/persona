#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
Leaving out the requests for session_context which wsapi_client will make automagically.
This is for a secondary email address that is not known.
GET  200 application/json /wsapi/address_info?email=someuser%40somedomain.com
POST 200 application/json /wsapi/stage_user
GET  200 application/json /wsapi/user_creation_status?email=someuser%40somedomain.com ... repeats
GET  200 application/json /wsapi/email_for_token?token=XfffffffoGowzPuZi5oVP50NXuTW4DBENSv47NI5PgMJSV
POST 200 application/json /wsapi/complete_user_creation
GET  200 application/json /wsapi/user_creation_status?email=someuser%40somedomain.com
POST 200 application/json /wsapi/authenticate_user
GET  200 application/json /wsapi/list_emails
POST 200 application/json /wsapi/account_cancel
*/

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

var suite = vows.describe('account-cancel');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const
TEST_EMAIL = secrets.weakGenerate(12) + '@somedomain.com',
TEST_PASS = 'thisismypassword',
TEST_SITE = 'http://fakesite.com';

// create a new secondary account
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

suite.addBatch({
  "the test user": {
    topic: wsapi.get('/wsapi/address_info', {
        email: TEST_EMAIL,
    }),
    "is a known user after account was created": function(err, r) {
      assert.strictEqual(r.code, 200);
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.type, "secondary");
      assert.strictEqual(resp.state, "known");
      assert.strictEqual(resp.disabled, false);
    }
  }
});

suite.addBatch({
  "POST cancel_account": {
    topic: wsapi.post('/wsapi/account_cancel', {}),
    "yields a HTTP 200": function (err, r) {
      assert.strictEqual(r.code, 200);
    },
    "Content-type is 'application/json'": function(err, r) {
      assert.strictEqual(r.headers['content-type'].indexOf('application/json'), 0);
    },
    "returns json string with { success: true }": function (err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    },
  },
});

suite.addBatch({
  "the test user": {
    topic: wsapi.get('/wsapi/address_info', {
        email: TEST_EMAIL,
    }),
    "is not a known user after account was cancelled": function(err, r) {
      assert.strictEqual(r.code, 200);
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.type, "secondary");
      assert.strictEqual(resp.state, "unknown");
      assert.strictEqual(resp.disabled, false);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
