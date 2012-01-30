#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
email = require('../lib/email.js'),
ca = require('../lib/keysigner/ca.js'),
jwcert = require('jwcrypto/jwcert'),
jwk = require('jwcrypto/jwk'),
jws = require('jwcrypto/jws');

var suite = vows.describe('ca');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

// generate a public key
var kp = jwk.KeyPair.generate("RS",64);

var email_addr = "foo@foo.com";

// certify a key
suite.addBatch({
  "certify a public key": {
    topic: function() {
      var expiration = new Date();
      expiration.setTime(new Date().valueOf() + 5000);
      return ca.certify('127.0.0.1', email_addr, kp.publicKey, expiration);
    },
    "parses" : function(cert_raw, err) {
      var cert = ca.parseCert(cert_raw);
      assert.notEqual(cert, null);
    },
    "verifies": function(cert_raw, err) {
      // FIXME we might want to turn this into a true async test
      // rather than one that is assumed to be synchronous although
      // it has an async structure
      ca.verifyChain('127.0.0.1', [cert_raw], function(pk) {
        assert.isTrue(kp.publicKey.equals(pk));
      });
    }
  },
  "certify a chain of keys": {
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
