#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
ca = require('../lib/keysigner/ca.js'),
jwcrypto = require("jwcrypto");

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
var kp;

suite.addBatch({
  "generate a keypair": {
    topic: function() {
      jwcrypto.generateKeypair({algorithm: "RS", keysize: 64}, this.callback);
    },
    "works": function(err, keypair) {
      assert.isNull(err);
      assert.isObject(keypair);
      kp = keypair;
    },
    "check the public key": {
      topic: function() {
        wsapi.get("/pk").call(this);
      },
      "returns a 200": function(err, r) {
        assert.strictEqual(r.code, 200);
      },
      "returns the right public key": function(err, r) {
        var pk = jwcrypto.loadPublicKey(r.body);
        assert.ok(pk);
      }
    },
    "cert key with no parameters": {
      topic: function() {
        wsapi.post(cert_key_url, {}).call(this);
      },
      "fails with HTTP 400" : function(err, r) {
        assert.strictEqual(r.code, 400);
      }
    },
    "cert key invoked with just an email": {
      topic: function() {
        wsapi.post(cert_key_url, { email: 'syncer@somehost.com' }).call(this);
      },
      "returns a 400" : function(err, r) {
        assert.strictEqual(r.code, 400);
      }
    },
    "cert key invoked with proper argument": {
      topic: function() {
        wsapi.post(cert_key_url, {
          email: 'syncer@somehost.com',
          pubkey: kp.publicKey.serialize(),
          ephemeral: false
        }).call(this);
      },
      "returns a response with a proper content-type" : function(err, r) {
        assert.strictEqual(r.code, 200);
      },
      "generate an assertion": {
        topic: function(err, r) {
          var serializedCert = r.body.toString();
          var expiration = new Date(new Date().getTime() + (2 * 60 * 1000));

          var self = this;
          jwcrypto.assertion.sign({}, {issuer: "127.0.0.1", expiresAt: expiration, issuedAt: new Date()}, kp.secretKey, function(err, signedObject) {
            if (err) return self.callback(err);
            
            self.callback(null, {
              certificates: [serializedCert],
              assertion: signedObject
            });
          });
        },
        "full bundle looks good": function(err, certs_and_assertion) {
          assert.isNull(err);
          assert.equal(certs_and_assertion.certificates[0].split(".").length, 3);
          assert.equal(certs_and_assertion.assertion.split(".").length, 3);
        },
      }
    },
    "cert key invoked proper arguments but incorrect email address": {
      topic: function() {
        wsapi.post(cert_key_url, {
          email: 'syncer2@somehost.com',
          pubkey: kp.publicKey.serialize(),
          ephemeral: false
        }).call(this);
      },
      "returns a response with a proper error content-type" : function(err, r) {
        assert.strictEqual(r.code, 400);
      }
    }
  },
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
