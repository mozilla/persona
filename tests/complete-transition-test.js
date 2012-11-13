#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
db = require('../lib/db.js'),
email = require('../lib/email.js'),
jwcrypto = require('jwcrypto'),
primary = require('./lib/primary.js'),
start_stop = require('./lib/start-stop.js'),
vows = require('vows'),
wsapi = require('./lib/wsapi.js');

var suite = vows.describe('forgotten-email');

// algs
require("jwcrypto/lib/algs/ds");
require("jwcrypto/lib/algs/rs");

start_stop.addStartupBatches(suite);

// every time a new token is sent out, let's update the global
// var 'token'
var token;

const TEST_DOMAIN = 'example.domain',
      TEST_EMAIL = 'testuser@' + TEST_DOMAIN,
      TEST_ORIGIN = 'http://127.0.0.1:10002';

var primaryUser = new primary({
  email: TEST_EMAIL,
  domain: TEST_DOMAIN
});

suite.addBatch({
  "set things up": {
    topic: function() {
      primaryUser.setup(this.callback);
    },
    "works": function() {
      // nothing to do here
    }
  }
});

// now let's generate an assertion using this user
suite.addBatch({
  "generating an assertion": {
    topic: function() {
      primaryUser.getAssertion(TEST_ORIGIN, this.callback);
    },
    "succeeds": function(err, r) {
      assert.isString(r);
    },
    "and logging in with the assertion succeeds": {
      topic: function(err, assertion)  {
        wsapi.post('/wsapi/auth_with_assertion', {
          assertion: assertion,
          ephemeral: true
        }).call(this);
      },
      "works": function(err, r) {
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.isTrue(resp.success);
      }
    }
  }
});


suite.addBatch({
  "Mark a transition as having been seen": {
    topic: wsapi.post('/wsapi/complete_transition', {
        email: TEST_EMAIL
    }),
    "request successful": function(err, r) {
      assert.equal(r.code, 200);
      assert.strictEqual(true, JSON.parse(r.body).success);
      token = undefined;
    },
    "db updated": {
      topic: function () {
        db.emailLastUsedAs(TEST_EMAIL, this.callback);
      },
      "lastUseAs updated": function (err, lastUsedAs) {
        assert.isNull(err);
        assert.equal(lastUsedAs, 'primary');
      }
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
