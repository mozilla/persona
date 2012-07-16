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
primary = require('./lib/primary.js'),
util = require('util'),
jwcrypto = require('jwcrypto');

require("jwcrypto/lib/algs/rs");
require("jwcrypto/lib/algs/ds");

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

// We've verified that the proxy IDP configuration allows us to simulate a delegated authority.
// Now let's test the other part of this puzzle - that users can log in with certs issued
// by our proxy idp servers. (for which the issuer is login.persona.org).
var primaryUser = new primary({
  email: "bartholomew@yahoo.com",
  domain: "127.0.0.1",
  privKey: jwcrypto.loadSecretKey(
    require('fs').readFileSync(
      path.join(__dirname, '..', 'var', 'root.secretkey')))
});

suite.addBatch({
  "initializing a primary user": {
    topic: function() {
      primaryUser.setup(this.callback);
    },
    "works": function() {
      // nothing to do here
    }
  }
});

suite.addBatch({
  "generating an assertion targeted at the persona service": {
    topic: function() {
      primaryUser.getAssertion('http://127.0.0.1:10002', this.callback);
    },
    "succeeds": function(err, r) {
      assert.isString(r);
    },
    "and logging in with the assertion": {
      topic: function(err, assertion)  {
        wsapi.post('/wsapi/auth_with_assertion', {
          assertion: assertion,
          ephemeral: true
        }).call(this);
      },
      "succeeds": function(err, r) {
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.isTrue(resp.success);
      }
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
