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
jwk = require('jwcrypto/jwk'),
jwt = require('jwcrypto/jwt');

var suite = vows.describe('cert-emails');

var token = undefined;

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

// INFO: some of these tests are repeat of sync-emails... to set
// things up properly for key certification

// create a new account via the api with (first address)
suite.addBatch({
  "staging an account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'syncer@somehost.com',
      pass: 'fakepass',
      // TODO: is this pubkey needed?
      pubkey: 'fakekey',
      site:'http://fakesite.com'
    }),
    "succeeds": function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  }
});

// wait for the token
suite.addBatch({
  "a token": {
    topic: function() {
      start_stop.waitForToken(this.callback);
    },
    "is obtained": function (t) {
      assert.strictEqual(typeof t, 'string');
      token = t;
    }
  }
});

suite.addBatch({
  "verifying account ownership": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', { token: token }).call(this);
    },
    "works": function(err, r) {
      assert.equal(r.code, 200);
      assert.strictEqual(true, JSON.parse(r.body).success);
    }
  }
});

var cert_key_url = "/wsapi/cert_key";

// generate a keypair, we'll use this to sign assertions, as if
// this keypair is stored in the browser localStorage
var kp = jwk.KeyPair.generate("RS",64);

suite.addBatch({
  "check the public key": {
    topic: wsapi.get("/pk"),
    "returns a 200": function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "returns the right public key": function(err, r) {
      var pk = jwk.PublicKey.deserialize(r.body);
      assert.ok(pk);
    }
  },
  "cert key with no parameters": {
    topic: wsapi.post(cert_key_url, {}),
    "fails with HTTP 400" : function(err, r) {
      assert.strictEqual(r.code, 400);
    }
  },
  "cert key invoked with just an email": {
    topic: wsapi.post(cert_key_url, { email: 'syncer@somehost.com' }),
    "returns a 400" : function(err, r) {
      assert.strictEqual(r.code, 400);
    }
  },
  "cert key invoked with proper argument": {
    topic: wsapi.post(cert_key_url, {
      email: 'syncer@somehost.com',
      pubkey: kp.publicKey.serialize(),
      ephemeral: false
    }),
    "returns a response with a proper content-type" : function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "returns a proper cert": function(err, r) {
      ca.verifyChain('127.0.0.1', [r.body], function(pk) {
        assert.isTrue(kp.publicKey.equals(pk));
      });
    },
    "generate an assertion": {
      topic: function(err, r) {
        var serializedCert = r.body.toString();
        var expiration = new Date(new Date().getTime() + (2 * 60 * 1000));
        var assertion = new jwt.JWT(null, expiration, "rp.com");
        var full_assertion = {
          certificates: [serializedCert],
          assertion: assertion.sign(kp.secretKey)
        };

        return full_assertion;
      },
      "full assertion looks good": function(full_assertion) {
        assert.equal(full_assertion.certificates[0].split(".").length, 3);
        assert.equal(full_assertion.assertion.split(".").length, 3);
      },
      "assertion verifies": {
        topic: function(full_assertion) {
          var cb = this.callback;
          // extract public key at the tail of the chain
          ca.verifyChain('127.0.0.1', full_assertion.certificates, function(pk) {
            if (!pk)
              cb(false);

            var assertion = new jwt.JWT();
            assertion.parse(full_assertion.assertion);
            cb(assertion.verify(pk));
          });
        },
        "verifies": function(result, err) {
          assert.isTrue(result);
        }
      }
    }
  },
  "cert key invoked proper arguments but incorrect email address": {
    topic: wsapi.post(cert_key_url, {
      email: 'syncer2@somehost.com',
      pubkey: kp.publicKey.serialize(),
      ephemeral: false
    }),
    "returns a response with a proper error content-type" : function(err, r) {
      assert.strictEqual(r.code, 400);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
