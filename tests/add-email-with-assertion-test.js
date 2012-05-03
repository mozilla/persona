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
jwk = require('jwcrypto/jwk.js'),
jwt = require('jwcrypto/jwt.js'),
vep = require('jwcrypto/vep.js'),
jwcert = require('jwcrypto/jwcert.js'),
http = require('http'),
querystring = require('querystring'),
path = require("path");

var suite = vows.describe('auth-with-assertion');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_DOMAIN = 'example.domain',
      TEST_EMAIL = 'testuser@' + TEST_DOMAIN,
      TEST_ORIGIN = 'http://127.0.0.1:10002',
      TEST_FIRST_ACCT = 'test.user+folder@fake.domain';

// This test will excercise the ability to add an email to an
// account using an assertion from a primary

// now we need to generate a keypair and a certificate
// signed by our in tree authority
var g_keypair, g_cert;

suite.addBatch({
  "generating a keypair": {
    topic: function() {
      return jwk.KeyPair.generate("DS", 256)
    },
    "succeeds": function(r, err) {
      assert.isObject(r);
      assert.isObject(r.publicKey);
      assert.isObject(r.secretKey);
      g_keypair = r;
    }
  }
});

// for this trick we'll need the "secret" key of our built in
// primary
var g_privKey = jwk.SecretKey.fromSimpleObject(
  JSON.parse(require('fs').readFileSync(
    path.join(__dirname, '..', 'example', 'primary', 'sample.privatekey'))));


suite.addBatch({
  "generting a certificate": {
    topic: function() {
      var domain = process.env['SHIMMED_DOMAIN'];

      var expiration = new Date();
      expiration.setTime(new Date().valueOf() + 60 * 60 * 1000);
      g_cert = new jwcert.JWCert(TEST_DOMAIN, expiration, new Date(),
                                 g_keypair.publicKey, {email: TEST_EMAIL}).sign(g_privKey);
      return g_cert;
    },
    "works swimmingly": function(cert, err) {
      assert.isString(cert);
      assert.lengthOf(cert.split('.'), 3);
    }
  }
});

// now let's generate an assertion using the cert
suite.addBatch({
  "generating an assertion": {
    topic: function() {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion([g_cert], tok.sign(g_keypair.secretKey));
    },
    "succeeds": function(r, err) {
      assert.isString(r);
      g_assertion = r;
    }
  }
});

suite.addBatch({
  "adding this email via assertion": {
    topic: function(assertion)  {
      wsapi.post('/wsapi/add_email_with_assertion', {
        assertion: g_assertion
      }).call(this);
    },
    "fails if not authenticated": function(err, r) {
      assert.strictEqual(r.code, 400);
    }
  }
});

// create a new account via the api with
suite.addBatch({
  "stage an account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: TEST_FIRST_ACCT,
      pass: 'fakepass',
      site:'http://fakesite.com:652'
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "and a token": {
      topic: function() {
        start_stop.waitForToken(this.callback);
      },
      "is obtained": function (t) {
        assert.strictEqual(typeof t, 'string');
      },
      "can be used": {
        topic: function(token) {
          wsapi.post('/wsapi/complete_user_creation', { token: token }).call(this);
        },
        "to verify email ownership": function(err, r) {
          assert.equal(r.code, 200);
          assert.strictEqual(JSON.parse(r.body).success, true);
          token = undefined;
        }
      }
    }
  }
});

suite.addBatch({
  "adding this email via assertion": {
    topic: function(assertion)  {
      wsapi.post('/wsapi/add_email_with_assertion', {
        assertion: g_assertion
      }).call(this);
    },
    "works once we are authenticated": function(err, r) {
      var resp = JSON.parse(r.body);
      assert.isObject(resp);
      assert.isTrue(resp.success);
    }
  }
});

suite.addBatch({
  "list emails": {
    topic: wsapi.get('/wsapi/list_emails', {}),
    "succeeds with HTTP 200" : function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "returns an object with what we'd expect": function(err, r) {
      var respObj = JSON.parse(r.body);
      var emails = Object.keys(respObj);
      assert.strictEqual(emails.length, 2)
      assert.ok(emails.indexOf(TEST_EMAIL) != -1);
      assert.ok(emails.indexOf(TEST_FIRST_ACCT) != -1);
      assert.equal(respObj[TEST_EMAIL].type, "primary");
      assert.equal(respObj[TEST_FIRST_ACCT].type, "secondary");
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
