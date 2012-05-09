#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
vows = require('vows'),
ca = require('../lib/keysigner/ca.js'),
jwcrypto = require('jwcrypto');

// algorithms
require("jwcrypto/lib/algs/rs");

var suite = vows.describe('ca');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

var email_addr = "foo@foo.com";
var issuer = "127.0.0.1";

var kp = null;

// certify a key
suite.addBatch({
  "generate a keypair": {
    topic: function() {
      // generate a public key
      jwcrypto.generateKeypair({algorithm: "RS", keysize: 64}, this.callback);
    },
    "got a keypair": function(err, keypair) {
      assert.isNull(err);
      assert.isObject(keypair);
      kp = keypair;
    },
    "certify a public key": {
      topic: function() {
        var expiration = new Date();
        expiration.setTime(new Date().valueOf() + 5000);
        ca.certify(issuer, email_addr, kp.publicKey, expiration, this.callback);
      },
      "does not error out": function(err, cert_raw) {
        assert.isNull(err);
        assert.isNotNull(cert_raw);
      },
      "looks ok" : function(err, cert_raw) {
        assert.equal(cert_raw.split(".").length, 3);
      }
    }
  }
});
               
// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
