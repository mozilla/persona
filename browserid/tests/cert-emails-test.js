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

const assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
email = require('../lib/email.js'),
ca = require('../lib/ca.js'),
jwcert = require('jwcrypto/jwcert'),
jwk = require('jwcrypto/jwk'),
jws = require('jwcrypto/jws'),
jwt = require('jwcrypto/jwt');

var suite = vows.describe('cert-emails');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

// ever time a new token is sent out, let's update the global
// var 'token'
var token = undefined;
email.setInterceptor(function(email, site, secret) { token = secret; });

// INFO: some of these tests are repeat of sync-emails... to set
// things up properly for key certification

// create a new account via the api with (first address)
suite.addBatch({
  "stage an account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'syncer@somehost.com',
      pubkey: 'fakekey',
      site:'fakesite.com'
    }),
    "yields a sane token": function(r, err) {
      assert.strictEqual(typeof token, 'string');
    }
  }
});

suite.addBatch({
  "verifying account ownership": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', { token: token, pass: 'fakepass' }).call(this);
    },
    "works": function(r, err) {
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
    "returns a 200": function(r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns the right public key": function(r, err) {
      var pk = jwk.PublicKey.deserialize(r.body);
      assert.ok(pk);
    }
  },
  "cert key with no parameters": {
    topic: wsapi.post(cert_key_url, {}),
    "fails with HTTP 400" : function(r, err) {
      assert.strictEqual(r.code, 400);
    }
  },
  "cert key invoked with just an email": {  
    topic: wsapi.post(cert_key_url, { email: 'syncer@somehost.com' }),
    "returns a 400" : function(r, err) {
      assert.strictEqual(r.code, 400);
    }
  },
  "cert key invoked with proper argument": {  
    topic: wsapi.post(cert_key_url, { email: 'syncer@somehost.com', pubkey: kp.publicKey.serialize() }),
    "returns a response with a proper content-type" : function(r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns a proper cert": function(r, err) {
      ca.verifyChain([r.body], function(pk) {
        assert.isTrue(kp.publicKey.equals(pk));
      });
    },
    "generate an assertion": {
      topic: function(r) {
        var serializedCert = r.body.toString();
        var assertion = new jwt.JWT(null, new Date(), "rp.com");
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
          ca.verifyChain(full_assertion.certificates, function(pk) {
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
    topic: wsapi.post(cert_key_url, { email: 'syncer2@somehost.com', pubkey: kp.publicKey.serialize() }),
    "returns a response with a proper error content-type" : function(r, err) {
      assert.strictEqual(r.code, 400);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
