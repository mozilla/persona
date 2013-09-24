#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This tests excercises discovery and attempt to excercise all
 * possible response values from it.  */

require('./lib/test_env.js');

const
assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
config = require('../lib/configuration.js'),
util = require('util'),
path = require('path');

var suite = vows.describe('discovery');

const TEST_DOMAIN = "example.domain",
      TEST_EMAIL = "test@" + TEST_DOMAIN,
      TEST_ORIGIN = 'http://127.0.0.1:10002';

const SECONDARY_TEST_DOMAIN = "example.com";

// an explicitly disabled domain
process.env['SHIMMED_PRIMARIES'] =
  util.format("disabled.domain|http://127.0.0.1:10005|%s", path.join(__dirname, 'data',
    'disabled.domain', '.well-known', 'browserid'));

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

suite.addBatch({
  "discovery for a primary IdP": {
    topic: wsapi.get('/wsapi/discovery', {
      domain: TEST_DOMAIN
    }),
    "returns well known": function(e, r) {
      assert.isNull(e);
      var res = JSON.parse(r.body);
      assert.equal(res.authentication, "http://127.0.0.1:10005/sign_in.html");
      assert.equal(res.provisioning, "http://127.0.0.1:10005/provision.html");
      assert.isNotNull(res['public-key']);
    }
  }
});

suite.addBatch({
  "discovery for the fallback IdP": {
     topic: wsapi.get('/wsapi/discovery', {
     domain: SECONDARY_TEST_DOMAIN
     }),
    "returns a well known": function(e, r) {
      assert.isNull(e);
      var res = JSON.parse(r.body);
      assert.equal(res.authentication, "http://127.0.0.1:10002/auth#NATIVE");
      assert.equal(res.provisioning, "http://127.0.0.1:10002/provision");
      assert.isNotNull(res['public-key']);
    }
  }
});

suite.addBatch({
  "Bad usage of discovery": {
     topic: wsapi.get('/wsapi/discovery', {}),
    "gives an error": function(e, r) {
        assert.isNull(e);
        assert.equal(r.code, 400);
        var res = JSON.parse(r.body);
	assert.equal(res.success, false);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
