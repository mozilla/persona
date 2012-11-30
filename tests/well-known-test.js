#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const
assert = require('assert'),
vows = require('vows'),
path = require('path'),
util = require('util');

const TEST_DOMAIN = 'example.domain',
      TEST_DOMAIN_PATH = path.join(__dirname,
        '..', 'example', 'primary', '.well-known', 'browserid'),
      TEST_ORIGIN = 'http://127.0.0.1:10002',
      TEST_DELEGATE_DOMAIN = 'delegate.example.domain',
      TEST_DELEGATE_DOMAIN_PATH = path.join(__dirname,
        '..', 'example', 'delegated_primary', '.well-known', 'browserid');

// Good examples
process.env['SHIMMED_PRIMARIES'] =
  'example.domain|http://127.0.0.1:10005|' + TEST_DOMAIN_PATH;
process.env['SHIMMED_PRIMARIES'] += "," +
  'delegate.example.domain|http://127.0.0.1:10005|' + TEST_DELEGATE_DOMAIN_PATH;

// A series of redirects delegate0.domain -> delegate1.domain -> ... delegate11.domain
function mk_delegate(i) {
  var f = util.format;
  var p = path.join(__dirname, 'data', f('delegate%s.domain', i), '.well-known', 'browserid');
  process.env['SHIMMED_PRIMARIES'] += "," +
  f("delegate%s.domain|http://127.0.0.1:10005|%s", i, p);
}
for (var i=0; i <= 10; i++) {
  mk_delegate(i);
}

// delegates to hozed.domain
process.env['SHIMMED_PRIMARIES'] += "," +
  util.format("hozed.domain|http://127.0.0.1:10005|%s", path.join(__dirname, 'data',
    'hozed.domain', '.well-known', 'browserid'));

// Next two delegate to each other forming a cycle
process.env['SHIMMED_PRIMARIES'] += "," +
  util.format("cycle.domain|http://127.0.0.1:10005|%s", path.join(__dirname, 'data',
    'cycle.domain', '.well-known', 'browserid'));

process.env['SHIMMED_PRIMARIES'] += "," +
  util.format("cycle2.domain|http://127.0.0.1:10005|%s", path.join(__dirname, 'data',
    'cycle2.domain', '.well-known', 'browserid'));

// a domain with a well-known document with an unparsable authority
process.env['SHIMMED_PRIMARIES'] += "," +
  util.format("borkedauthority.domain|http://127.0.0.1:10005|%s", path.join(__dirname, 'data',
    'borkedauthority.domain', '.well-known', 'browserid'));

// an explicitly disabled domain
process.env['SHIMMED_PRIMARIES'] += "," +
  util.format("disabled.domain|http://127.0.0.1:10005|%s", path.join(__dirname, 'data',
    'disabled.domain', '.well-known', 'browserid'));

var primary = require('../lib/primary.js');

var suite = vows.describe('delegated-primary');

// DB test look

// Tests related to domains that delegate their authority to another
// primary.

// now let's generate an assertion using this user

suite.addBatch({
  "Retrieving a public key is straight forward": {
    topic: function() {
      return primary.getPublicKey(TEST_DOMAIN, this.callback);
    },
    "succeeds": function(err, pubKey) {
      assert.equal(pubKey.keysize, '256');
      assert.equal(pubKey.algorithm, 'RS');
    }
  }
});

suite.addBatch({
  "Retrieving a public key should follow authority delegation": {
    topic: function() {
      return primary.getPublicKey(TEST_DELEGATE_DOMAIN, this.callback);
    },
    "succeeds": function(err, pubKey) {
      assert.equal(pubKey.keysize, '256');
      assert.equal(pubKey.algorithm, 'RS');
    }
  }
});

suite.addBatch({
  "Cycles should be detected": {
    topic: function() {
      return primary.getPublicKey('cycle.domain', this.callback);
    },
    "succeeds": function(err, pubKey) {
      assert.strictEqual(err,
        "can't get public key for cycle.domain: " +
        'Circular reference in delegating authority: cycle.domain > cycle2.domain');
    }
  }
});

suite.addBatch({
  "We should not follow an infinite series of delegations of authority": {
    topic: function() {
      return primary.getPublicKey('delegate0.domain', this.callback);
    },
    "succeeds": function(err, pubKey) {
      assert.strictEqual(err,
        "can't get public key for delegate0.domain: " +
        'Too many hops while delegating authority: delegate0.domain > delegate1.domain > ' +
        'delegate2.domain > delegate3.domain > delegate4.domain > delegate5.domain > ' +
        'delegate6.domain');
    }
  }
});

suite.addBatch({
  "A domain delegating to itself is hozed...": {
    topic: function() {
      return primary.getPublicKey('hozed.domain', this.callback);
    },
    "succeeds": function(err, pubKey) {
      assert.strictEqual(err.indexOf('Circular reference in delegating authority'), 39);
    }
  }
});

suite.addBatch({
  "if the authority key is malformed": {
    topic: function() {
      return primary.checkSupport('borkedauthority.domain', this.callback);
    },
    "support is disabled": function(err, r) {
      assert.equal(
        err,
        "bad support document for 'borkedauthority.domain': malformed authority");
    }
  }
});

suite.addBatch({
  "if `disabled: true` is present": {
    topic: function() {
      return primary.checkSupport('disabled.domain', this.callback);
    },
    "support is disabled": function(err, r) {
      assert.isNull(err);
      assert.strictEqual(r.disabled, true);
    }
  }
});


// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
