#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const
assert = require('assert'),
vows = require('vows'),
path = require('path'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
util = require('util');

var suite = vows.describe('delegated-primary');

const TEST_DOMAIN_PATH =
  path.join(__dirname, '..', 'example', 'primary', '.well-known', 'browserid');

process.env['PROXY_IDPS'] = JSON.stringify({
  "yahoo.com": "example.domain",
  "real.primary": "example.com", // this should be ignored, because real.primary is a shimmed real primary, below
  "broken.primary": "example.com" // this should fallback to secondary, because example.com is not a real primary
});

process.env['SHIMMED_PRIMARIES'] =
  'example.domain|http://127.0.0.1:10005|' + TEST_DOMAIN_PATH +
  ',real.primary|http://127.0.0.1:10005|' + TEST_DOMAIN_PATH;


start_stop.addStartupBatches(suite);

suite.addBatch({
  "proxy_idp configuration": {
    topic: wsapi.get('/wsapi/address_info', {
        email: 'bartholomew@yahoo.com'
    }),
    " acts as delegated authority": function(err, r) {
      assert.strictEqual(r.code, 200);
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.auth, "http://127.0.0.1:10005/sign_in.html");
      assert.strictEqual(resp.prov, "http://127.0.0.1:10005/provision.html");
      assert.strictEqual(resp.type, "primary");
    }
  }
});

suite.addBatch({
  "if bigtent breaks": {
    topic: wsapi.get('/wsapi/address_info', {
        email: 'bartholomew@broken.primary'
    }),
    "we fallback to secondary validation, just because that's how the protocol works": function(err, r) {
      assert.strictEqual(r.code, 200);
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.type, "secondary");
      assert.strictEqual(resp.known, false);
    }
  }
});

suite.addBatch({
  "real primaries always override proxy_idp configuration": {
    topic: wsapi.get('/wsapi/address_info', {
        email: 'bartholomew@real.primary'
    }),
    "because we want real primaries to step up": function(err, r) {
      assert.strictEqual(r.code, 200);
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.auth, "http://127.0.0.1:10005/sign_in.html");
      assert.strictEqual(resp.prov, "http://127.0.0.1:10005/provision.html");
      assert.strictEqual(resp.type, "primary");
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
