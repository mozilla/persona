#!/usr/bin/env node

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
vep = require('jwcrypto/vep.js');

var suite = vows.describe('verifier');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_EMAIL = 'someuser@somedomain.com',
      TEST_PASSWORD = 'thisismyoldpassword',
      TEST_DOMAIN = 'fakesite.com',
      TEST_ORIGIN = 'http://fakesite.com:8080';

var token = undefined;

// let's create a user and certify a key so we can
// generate assertions
suite.addBatch({
  "account staging": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: TEST_EMAIL,
      site: TEST_DOMAIN
    }),
    "works":     function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "a token": {
    topic: function() {
      start_stop.waitForToken(this.callback);
    },
    "is obtained": function (t) {
      assert.isString(t);
      token = t;
    }
  }
});

suite.addBatch({
  "setting password and creating the account": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', {
        token: token,
        pass: TEST_PASSWORD
      }).call(this);
    },
    "works just fine": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

// now we need to generate a keypair
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

suite.addBatch({
  "certifying the public key": {
    topic: function() {
      wsapi.post('/wsapi/cert_key', {
        email: TEST_EMAIL,
        pubkey: g_keypair.publicKey.serialize()
      }).call(this);
    },
    "works swimmingly": function(r, err) {
      assert.isString(r.body);
      g_cert = r.body;
      assert.lengthOf(g_cert.split('.'), 3);
    }
  }
});

// several positive and negative basic verification tests
// with a valid assertion
suite.addBatch({
  "generating an assertion": {
    topic: function() {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion([g_cert],
                                         tok.sign(g_keypair.secretKey));
    },
    "succeeds": function(r, err) {
      assert.isString(r);
    },
    "and verifying that assertion by specifying domain as audience": {
      topic: function(assertion)  {
        wsapi.post('/verify', {
          audience: TEST_DOMAIN,
          assertion: assertion
        }).call(this);
      },
      "works": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.strictEqual(resp.status, 'okay');
        assert.strictEqual(resp.email, TEST_EMAIL);
        assert.strictEqual(resp.audience, TEST_DOMAIN);
        var now = new Date().getTime();
        assert.strictEqual(resp.expires > now, true);
        assert.strictEqual(resp.expires <= now + (2 * 60 * 1000), true);
        assert.strictEqual(resp.status, 'okay');
      }
    },
    "and verifying that assertion by specifying origin as audience": {
      topic: function(assertion)  {
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "works": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.strictEqual(resp.status, 'okay');
        assert.strictEqual(resp.email, TEST_EMAIL);
        assert.strictEqual(resp.audience, TEST_ORIGIN);
        var now = new Date().getTime();
        assert.strictEqual(resp.expires > now, true);
        assert.strictEqual(resp.expires <= now + (2 * 60 * 1000), true);
        assert.strictEqual(resp.status, 'okay');
      }
    },
    "but specifying the wrong audience": {
      topic: function(assertion)  {
        wsapi.post('/verify', {
          audience: "notfakesite.com",
          assertion: assertion
        }).call(this);
      },
      "fails with a nice error": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'audience mismatch');
      }
    },
    "but specifying the wrong port": {
      topic: function(assertion)  {
        wsapi.post('/verify', {
          audience: "http://fakesite.com:8888",
          assertion: assertion
        }).call(this);
      },
      "fails with a nice error": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'audience mismatch');
      }
    },
    "but specifying the wrong scheme": {
      topic: function(assertion)  {
        wsapi.post('/verify', {
          audience: "https://fakesite.com:8080",
          assertion: assertion
        }).call(this);
      },
      "fails with a nice error": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'audience mismatch');
      }
    },
    "and providing just a domain and port": {
      topic: function(assertion)  {
        wsapi.post('/verify', {
          audience: "fakesite.com:8080",
          assertion: assertion
        }).call(this);
      },
      "is cool": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.strictEqual(resp.status, 'okay');
        assert.strictEqual(resp.email, TEST_EMAIL);
        assert.strictEqual(resp.audience, 'fakesite.com:8080');
        var now = new Date().getTime();
        assert.strictEqual(resp.expires > now, true);
        assert.strictEqual(resp.expires <= now + (2 * 60 * 1000), true);
        assert.strictEqual(resp.status, 'okay');
      }
    },
    "but providing just a domain and the wrong port": {
      topic: function(assertion)  {
        wsapi.post('/verify', {
          audience: "fakesite.com:8888",
          assertion: assertion
        }).call(this);
      },
      "fails as you would expect": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'audience mismatch');
      }
    },
    "leaving off the audience": {
      topic: function(assertion)  {
        wsapi.post('/verify', {
          assertion: assertion
        }).call(this);
      },
      "fails as you would expect": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'need assertion and audience');
      }
    },
    "leaving off the assertion": {
      topic: function(assertion)  {
        wsapi.post('/verify', {
          audience: TEST_ORIGIN
        }).call(this);
      },
      "fails as you would expect": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'need assertion and audience');
      }
    }
  }
});

// testing post format requirements and flexibility


start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
