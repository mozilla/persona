#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
db = require('../lib/db.js'),
config = require('../lib/configuration.js'),
http = require('http'),
querystring = require('querystring'),
primary = require('./lib/primary.js'),
jwcrypto = require('jwcrypto');

var suite = vows.describe('auth-with-assertion');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_DOMAIN = 'example.domain',
      TEST_EMAIL = 'testuser@' + TEST_DOMAIN,
      TEST_ORIGIN = 'http://127.0.0.1:10002',
      OTHER_EMAIL = 'otheruser@' + TEST_DOMAIN;


// here we go!  let's authenticate with an assertion from
// a primary.

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

// now let's generate an assertion using this user
suite.addBatch({
  "generating a new intermediate keypair and then an assertion": {
    topic: function() {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var self = this;

      jwcrypto.generateKeypair(
        {algorithm: "DS", keysize: 256},
        function(err, innerKeypair) {
          
          // sign this innerkeypair with the key from g_cert (g_keypair)
          jwcrypto.cert.sign(
            innerKeypair.publicKey, {email: OTHER_EMAIL},
            {issuedAt: new Date(), expiresAt: expirationDate},
            {}, primaryUser._keyPair.secretKey,
            function(err, innerCert) {

              jwcrypto.assertion.sign(
                {},
                {audience: TEST_ORIGIN, expiresAt: expirationDate},
                innerKeypair.secretKey, function(err, signedObject) {
                  if (err) return cb(err);

                  var fullAssertion = jwcrypto.cert.bundle(
                    [primaryUser._cert, innerCert], signedObject);

                  self.callback(null, fullAssertion);
                });
              
            });
        });
    },
    "succeeds": function(err, assertion) {
      assert.isString(assertion);
    },
    "and logging in with the assertion fails": {
      topic: function(err, assertion)  {
        wsapi.post('/wsapi/auth_with_assertion', {
          assertion: assertion,
          ephemeral: true
        }).call(this);
      },
      "fails": function(err, r) {
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.isFalse(resp.success);
        assert.equal(resp.reason, "certificate chaining is not yet allowed");
      }
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
