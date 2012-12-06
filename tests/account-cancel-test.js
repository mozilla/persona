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

var token;

// Okay now stage the user
suite.addBatch({
  "POST stage_user": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: TEST_EMAIL,
      pass:  TEST_PASS,
      site:  TEST_SITE,
    }),
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

// wait for the verification token
suite.addBatch({
  "a verification token": {
    topic: function() {
      start_stop.waitForToken(this.callback);
    },
    "is obtained": function (t) {
      assert.strictEqual(typeof t, 'string');
      token = t;
    }
  }
});

// create a new account
suite.addBatch({
  "POST complete_user_creation with token": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', {
        token: token
      }).call(this);
    },
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
  "GET user_creation_status after a creation is complete": {
    topic: wsapi.get("/wsapi/user_creation_status", {
      email: TEST_EMAIL,
    }),
    "yields a HTTP 200": function (err, r) {
      assert.strictEqual(r.code, 200);
    },
    "Content-type is 'application/json'": function(err, r) {
      assert.strictEqual(r.headers['content-type'].indexOf('application/json'), 0);
    },
    "returns json string with { status: 'complete', userid: \\d+ }": function (err, r) {
      assert.strictEqual(JSON.parse(r.body).status, "complete");
      assert(/\d+/.test(JSON.parse(r.body).userid));
    },
  }
});

suite.addBatch({
  "POST authenticate_user with the email and password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: TEST_PASS,
      ephemeral: true
    }),
    "yields a HTTP 200": function (err, r) {
      assert.strictEqual(r.code, 200);
    },
    "Content-type is 'application/json'": function(err, r) {
      assert.strictEqual(r.headers['content-type'].indexOf('application/json'), 0);
    },
    "returns json string with { success: true }": function (err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

suite.addBatch({
  "GET list_emails": {
    topic: wsapi.get('/wsapi/list_emails', {}),
    "succeeds with HTTP 200" : function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "returns an object with proper email": function(err, r) {
      var respObj = JSON.parse(r.body);
      var emails = respObj.emails;
      assert.strictEqual(respObj.success, true);
      assert.strictEqual(emails[0], TEST_EMAIL);
      assert.strictEqual(emails.length, 1);
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
