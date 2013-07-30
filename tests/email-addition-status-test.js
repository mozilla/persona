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
secrets = require('../lib/secrets.js');

var suite = vows.describe('email-addition-status');

var token;

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const
TEST_EMAIL_FIRST = secrets.weakGenerate(12) + '@somedomain.com',
TEST_EMAIL_ADDED = secrets.weakGenerate(12) + '@otherdomain.com',
TEST_PASSWORD = 'thisismypassword',
TEST_SITE = 'http://fakesite.com';

function jsonParse(str) {
  try {
    return JSON.parse(str);
  }
  catch(e) {
    return;
  }
}

// create a new secondary account
suite.addBatch({
  "creating a secondary account": {
    topic: function() {
      secondary.create({
        email: TEST_EMAIL_FIRST,
        pass:  TEST_PASSWORD,
        site:  TEST_SITE,
      }, this.callback);
    },
    "succeeds": function(err) {
      assert.isNull(err);
    }
  }
});

suite.addBatch({
  "the initial email address": {
    topic: wsapi.get('/wsapi/address_info', {
      email: TEST_EMAIL_FIRST,
    }),
    "is a known user after account was created": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.headers['content-type'].indexOf('application/json'), 0);
      var data = jsonParse(r.body);
      if (!data) return assert.fail("Could not parse JSON: " + r.body);
      assert.strictEqual(data.type, "secondary");
      assert.strictEqual(data.state, "known");
      assert.strictEqual(data.disabled, false);
      assert.strictEqual(data.issuer, '127.0.0.1');
      assert.strictEqual(data.normalizedEmail, TEST_EMAIL_FIRST);
    }
  }
});


suite.addBatch({
  "Checking email_addition_status for address that has not yet been added": {
    topic: wsapi.get('/wsapi/email_addition_status', {
      email: TEST_EMAIL_ADDED,
    }),
    "shows that 'status' is now 'failed'": function (err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.headers['content-type'].indexOf('application/json'), 0);
      var data = jsonParse(r.body);
      if (!data) return assert.fail("Could not parse JSON: " + r.body);
      assert.strictEqual(data.status, 'failed');
    },
  },
});


suite.addBatch({
  "staging another email to add to the account": {
    topic: wsapi.post('/wsapi/stage_email', {
      email: TEST_EMAIL_ADDED,
      site: TEST_SITE
    }),
    "succeeds": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.headers['content-type'].indexOf('application/json'), 0);
      var data = jsonParse(r.body);
      if (!data) return assert.fail("Could not parse JSON: " + r.body);
      assert.strictEqual(data.success, true);
    }
  }
});

suite.addBatch({
  "Checking email_addition_status": {
    topic: wsapi.get('/wsapi/email_addition_status', {
      email: TEST_EMAIL_ADDED,
    }),
    "shows that 'status' is 'pending'": function (err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.headers['content-type'].indexOf('application/json'), 0);
      var data = jsonParse(r.body);
      if (!data) return assert.fail("Could not parse JSON: " + r.body);
      assert.strictEqual(data.status, 'pending');
    },
  },
});

// wait for the token
suite.addBatch({
  "a token": {
    topic: function() {
      start_stop.waitForToken(this.callback);
    },
    "is obtained": function (err, t) {
      assert.isNull(err);
      assert.strictEqual(typeof t, 'string');
      token = t;
    }
  }
});

suite.addBatch({
  "Checking email_for_token": {
    topic: function() {
      wsapi.get('/wsapi/email_for_token', {
        token: token
      }).call(this);
    },
    "successfullly returns the correct email": function (err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.headers['content-type'].indexOf('application/json'), 0);
      var data = jsonParse(r.body);
      if (!data) return assert.fail("Could not parse JSON: " + r.body);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.must_auth, false);
      assert.strictEqual(data.needs_password, true);
      assert.strictEqual(data.email, TEST_EMAIL_ADDED);
    },
  },
});

suite.addBatch({
  "complete_email_confirmation with the token": {
    topic: function() {
      wsapi.post('/wsapi/complete_email_confirmation', {
        token: token,
      }).call(this);
    },
    "succeeds": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.headers['content-type'].indexOf('application/json'), 0);
      var data = jsonParse(r.body);
      if (!data) return assert.fail("Could not parse JSON: " + r.body);
      assert.strictEqual(data.success, true);
    }
  }
});

suite.addBatch({
  "Now checking email_addition_status": {
    topic: wsapi.get('/wsapi/email_addition_status', {
      email: TEST_EMAIL_ADDED,
    }),
    "shows that 'status' is now 'complete'": function (err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.headers['content-type'].indexOf('application/json'), 0);
      var data = jsonParse(r.body);
      if (!data) return assert.fail("Could not parse JSON: " + r.body);
      assert.strictEqual(data.status, 'complete');
    },
  },
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
