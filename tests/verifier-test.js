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
vep = require('jwcrypto/vep.js'),
jwcert = require('jwcrypto/jwcert.js'),
http = require('http'),
querystring = require('querystring');

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
        assert.strictEqual(resp.reason, 'audience mismatch: domain mismatch');
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
        assert.strictEqual(resp.reason, 'audience mismatch: port mismatch');
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
        assert.strictEqual(resp.reason, 'audience mismatch: scheme mismatch');
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
        assert.strictEqual(resp.reason, 'audience mismatch: port mismatch');
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
    "posting assertion and audience as get parameters in a post request": {
      topic: function(assertion)  {
        var cb = this.callback;
        var postArgs = { assertion: assertion, audience: TEST_ORIGIN };
        http.request({
          host: '127.0.0.1',
          port: 10000,
          path: '/verify?' + querystring.stringify(postArgs),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          method: "POST"
        }, function (res) {
          var body = "";
          res.on('data', function(chunk) { body += chunk; })
            .on('end', function() {
              cb(body);
            });
        }).on('error', function (e) {
          cb("error: ", e);
        }).end();
      },
      "works, oddly enough": function (r, err) {
        var resp = JSON.parse(r);
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
    "posting assertion in body and audience as get parameter in a post request": {
      topic: function(assertion)  {
        var cb = this.callback;
        var postArgs = querystring.stringify({ assertion: assertion });
        var getArgs = querystring.stringify({ audience: TEST_ORIGIN });
        var req = http.request({
          host: '127.0.0.1',
          port: 10000,
          path: '/verify?' + getArgs,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          method: "POST"
        }, function (res) {
          var body = "";
          res.on('data', function(chunk) { body += chunk; })
            .on('end', function() {
              cb(body);
            });
        }).on('error', function (e) {
          cb("error: ", e);
        });
        req.write(postArgs);
        req.end();
      },
      "works, oddly enough": function (r, err) {
        var resp = JSON.parse(r);
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
    "posting audience in body and asssertion as get parameter in a post request": {
      topic: function(assertion)  {
        var cb = this.callback;
        var getArgs = querystring.stringify({ assertion: assertion });
        var postArgs = querystring.stringify({ audience: TEST_ORIGIN });
        var req = http.request({
          host: '127.0.0.1',
          port: 10000,
          path: '/verify?' + getArgs,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          method: "POST"
        }, function (res) {
          var body = "";
          res.on('data', function(chunk) { body += chunk; })
            .on('end', function() {
              cb(body);
            });
        }).on('error', function (e) {
          cb("error: ", e);
        });
        req.write(postArgs);
        req.end();
      },
      "works, oddly enough": function (r, err) {
        var resp = JSON.parse(r);
        assert.isObject(resp);
        assert.strictEqual(resp.status, 'okay');
        assert.strictEqual(resp.email, TEST_EMAIL);
        assert.strictEqual(resp.audience, TEST_ORIGIN);
        var now = new Date().getTime();
        assert.strictEqual(resp.expires > now, true);
        assert.strictEqual(resp.expires <= now + (2 * 60 * 1000), true);
        assert.strictEqual(resp.status, 'okay');
      }
    }
  }
});

suite.addBatch({
  "generating an assertion": {
    topic: function() {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion([g_cert], tok.sign(g_keypair.secretKey));
    },
    "succeeds": function(r, err) {
      assert.isString(r);
    },
    "and submitting without proper Content-Type headers": {
      topic: function(assertion)  {
        var cb = this.callback;
        var postArgs = querystring.stringify({ assertion: assertion, audience: TEST_ORIGIN });
        var req = http.request({
          host: '127.0.0.1',
          port: 10000,
          path: '/verify',
          method: "POST"
        }, function (res) {
          var body = "";
          res.on('data', function(chunk) { body += chunk; })
            .on('end', function() {
              cb(body);
            });
        }).on('error', function (e) {
          cb("error: ", e);
        });
        req.write(postArgs);
        req.end();
      },
      "fails with a helpful error message": function(r, err) {
        var resp = JSON.parse(r);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'Content-Type expected to be one of: application/x-www-form-urlencoded, application/json');
      }
    },
    "while submitting as application/json": {
      topic: function(assertion)  {
        var cb = this.callback;
        var postArgs = JSON.stringify({ assertion: assertion, audience: TEST_ORIGIN });
        var req = http.request({
          host: '127.0.0.1',
          port: 10000,
          path: '/verify',
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          }
        }, function (res) {
          var body = "";
          res.on('data', function(chunk) { body += chunk; })
            .on('end', function() {
              cb(body);
            });
        }).on('error', function (e) {
          cb("error: ", e);
        });
        req.write(postArgs);
        req.end();
      },
      "works fabulously": function(r, err) {
        var resp = JSON.parse(r);
        assert.isObject(resp);
        assert.strictEqual(resp.status, 'okay');
        assert.strictEqual(resp.email, TEST_EMAIL);
        assert.strictEqual(resp.audience, TEST_ORIGIN);
        var now = new Date().getTime();
        assert.strictEqual(resp.expires > now, true);
        assert.strictEqual(resp.expires <= now + (2 * 60 * 1000), true);
        assert.strictEqual(resp.status, 'okay');
      }
    }
  }
});

// now verify that a incorrectly signed assertion yields a good error message
suite.addBatch({
  "generating an assertion from a bogus cert": {
    topic: function() {
      var fakeDomainKeypair = jwk.KeyPair.generate("RS", 64);
      var newClientKeypair = jwk.KeyPair.generate("DS", 256);
      expiration = new Date(new Date().getTime() + (1000 * 60 * 60 * 6));
      var cert = new jwcert.JWCert("127.0.0.1", expiration, new Date(), newClientKeypair.publicKey,
                                   {email: TEST_EMAIL}).sign(fakeDomainKeypair.secretKey);

      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion([cert], tok.sign(newClientKeypair.secretKey));
    },
    "yields a good looking assertion": function (r, err) {
      assert.isString(r);
      assert.equal(r.length > 0, true);
    },
    "will cause the verifier": {
      topic: function(assertion) {
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "to return a clear error message": function (r, err) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        // XXX: the verifier response should simply be "invalid signature"
        assert.strictEqual(resp.reason, 'bad signature in chain');
      }
    }
  }
});

// now let's really get down and screw with the assertion
suite.addBatch({
  "using an email address as an assertion (which is bogus)": {
    topic: function()  {
      wsapi.post('/verify', {
        audience: TEST_ORIGIN,
        assertion: "test@example.com"
      }).call(this);
    },
    "fails with a nice error": function(r, err) {
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.status, 'failure');
      assert.strictEqual(resp.reason, 'malformed assertion');
    }
  },
  "using an integer as an assertion (which is bogus)": {
    topic: function()  {
      wsapi.post('/verify', {
        audience: TEST_ORIGIN,
         assertion: 777
      }).call(this);
    },
    "fails with a nice error": function(r, err) {
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.status, 'failure');
      assert.strictEqual(resp.reason, 'malformed assertion');
    }
  },
  "generating a valid assertion": {
    topic: function()  {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion([g_cert], tok.sign(g_keypair.secretKey));
    },
    "and removing the last char from it": {
      topic: function(assertion) {
        assertion = assertion.substr(0, assertion.length - 1);
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "fails with a nice error": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'malformed assertion');
      }
    },
    "and removing the first char from it": {
      topic: function(assertion) {
        assertion = assertion.substr(1);
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "fails with a nice error": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'malformed assertion');
      }
    },
    "and appending gunk to it": {
      topic: function(assertion) {
        assertion += "gunk";
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "fails with a nice error": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'malformed assertion');
      }
    }
  }
});

// how about bogus parameters inside the assertion?
suite.addBatch({
  "An assertion that expired a millisecond ago": {
    topic: function()  {
      var expirationDate = new Date(new Date().getTime() - 10);
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      var assertion = vep.bundleCertsAndAssertion([g_cert], tok.sign(g_keypair.secretKey));
      wsapi.post('/verify', {
        audience: TEST_ORIGIN,
        assertion: assertion
      }).call(this);
    },
    "fails with a nice error": function(r, err) {
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.status, 'failure');
      // XXX: the verifier should return a clearer error message
      assert.strictEqual(resp.reason, 'verification failure');
    }
  }
});

// now verify that no-one other than browserid is allowed to issue assertions
// (until primary support is implemented)
suite.addBatch({
  "generating an assertion from a cert signed by some other domain": {
    topic: function() {
      var fakeDomainKeypair = jwk.KeyPair.generate("RS", 64);
      var newClientKeypair = jwk.KeyPair.generate("DS", 256);
      expiration = new Date(new Date().getTime() + (1000 * 60 * 60 * 6));
      var cert = new jwcert.JWCert("otherdomain.tld", expiration, new Date(), newClientKeypair.publicKey,
                                   {email: TEST_EMAIL}).sign(fakeDomainKeypair.secretKey);

      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion([cert], tok.sign(newClientKeypair.secretKey));
    },
    "yields a good looking assertion": function (r, err) {
      assert.isString(r);
      assert.equal(r.length > 0, true);
    },
    "will cause the verifier": {
      topic: function(assertion) {
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "to return a clear error message": function (r, err) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, "this verifier doesn't respect certs issued from domains other than: 127.0.0.1");
      }
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
