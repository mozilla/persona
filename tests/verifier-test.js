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
path = require('path');

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
      pass: TEST_PASSWORD,
      site: TEST_ORIGIN
    }),
    "works":     function(err, r) {
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
        token: token
      }).call(this);
    },
    "works just fine": function(err, r) {
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
    "succeeds": function(r) {
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
        pubkey: g_keypair.publicKey.serialize(),
        ephemeral: false
      }).call(this);
    },
    "works swimmingly": function(err, r) {
      assert.isString(r.body);
      g_cert = r.body;
      assert.lengthOf(g_cert.split('.'), 3);
    }
  }
});

// several positive and negative basic verification tests
// with a valid assertion
function make_basic_tests(new_style) {
  var title = "generating an assertion with " + (new_style ? "old style" : "new style");
  var tests = {
    topic: function() {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion([g_cert],
                                         tok.sign(g_keypair.secretKey),
                                         new_style);
    },
    "succeeds": function(r) {
      assert.isString(r);
    },
    "and verifying that assertion by specifying domain as audience": {
      topic: function(assertion)  {
        wsapi.post('/verify', {
          audience: TEST_DOMAIN,
          assertion: assertion
        }).call(this);
      },
      "works": function(err, r) {
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
      "works": function(err, r) {
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
      "fails with a nice error": function(err, r) {
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
      "fails with a nice error": function(err, r) {
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
      "fails with a nice error": function(err, r) {
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
      "is cool": function(err, r) {
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
      "fails as you would expect": function(err, r) {
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
      "fails as you would expect": function(err, r) {
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
      "fails as you would expect": function(err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'need assertion and audience');
      }
    }
  };

  var overall_test = {};
  overall_test[title] = tests;
  return overall_test;
};

suite.addBatch(make_basic_tests(false));
suite.addBatch(make_basic_tests(true));

// testing post format requirements and flexibility
// several positive and negative basic verification tests
// with a valid assertion
function make_post_format_tests(new_style) {
  var title = "generating an assertion with " + (new_style ? "old style" : "new style");
  var tests = {
    topic: function() {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion([g_cert],
                                         tok.sign(g_keypair.secretKey),
                                         new_style);
    },
    "succeeds": function(r) {
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
      "works, oddly enough": function (r) {
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
      "works, oddly enough": function (r) {
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
      "works, oddly enough": function (r) {
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
  };

  var overall_test = {};
  overall_test[title] = tests;
  return overall_test;
}

suite.addBatch(make_post_format_tests(false));
suite.addBatch(make_post_format_tests(true));

function make_post_format_2_tests(new_style) {
  var title = "generating an assertion with " + (new_style ? "old style" : "new style");
  var tests = {
    topic: function() {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion(
        [g_cert],
        tok.sign(g_keypair.secretKey),
        new_style);
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
  };
  var overall_test = {};
  overall_test[title] = tests;
  return overall_test;
};

suite.addBatch(make_post_format_2_tests(false));
suite.addBatch(make_post_format_2_tests(true));

// now verify that a incorrectly signed assertion yields a good error message
function make_incorrect_assertion_tests(new_style) {
  var title = "generating an assertion from a bogus cert with " + (new_style? "new style" : "old style");
  var tests = {
    topic: function() {
      var fakeDomainKeypair = jwk.KeyPair.generate("RS", 64);
      var newClientKeypair = jwk.KeyPair.generate("DS", 256);
      expiration = new Date(new Date().getTime() + (1000 * 60 * 60 * 6));
      var cert = new jwcert.JWCert("127.0.0.1", expiration, new Date(), newClientKeypair.publicKey,
                                   {email: TEST_EMAIL}).sign(fakeDomainKeypair.secretKey);

      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion(
        [cert],
        tok.sign(newClientKeypair.secretKey),
        new_style);
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
      "to return a clear error message": function (err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        // XXX: the verifier response should simply be "invalid signature"
        assert.strictEqual(resp.reason, 'bad signature in chain');
      }
    }
  };

  var overall_test = {};
  overall_test[title] = tests;
  return overall_test;
}

suite.addBatch(make_incorrect_assertion_tests(false));
suite.addBatch(make_incorrect_assertion_tests(true));

// now let's really get down and screw with the assertion
suite.addBatch({
  "using an email address as an assertion (which is bogus)": {
    topic: function()  {
      wsapi.post('/verify', {
        audience: TEST_ORIGIN,
        assertion: "test@example.com"
      }).call(this);
    },
    "fails with a nice error": function(err, r) {
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
    "fails with a nice error": function(err, r) {
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.status, 'failure');
      assert.strictEqual(resp.reason, 'malformed assertion');
    }
  }
});

function make_crazy_assertion_tests(new_style) {
  var title = "generating a valid assertion with " + (new_style ? "new style" : "old style");
  var tests = {
    topic: function()  {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion(
        [g_cert],
        tok.sign(g_keypair.secretKey),
        new_style);
    },
    "and removing the last two chars from it": {
      topic: function(assertion) {
        // we used to chop off one char, but because of
        // robustness in base64-decoding, that still worked 25%
        // of the time. No need to build this knowledge in here.
        assertion = assertion.substr(0, assertion.length - 2);
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "fails with a nice error": function(err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        // with new assertion format, the error is different
        if (new_style) {
          assert.strictEqual(resp.reason, 'verification failure');
        } else {
          assert.strictEqual(resp.reason, 'malformed assertion');
        }
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
      "fails with a nice error": function(err, r) {
        // XXX this test is failing because there's an exception thrown
        // that's revealing too much info about the malformed assertion
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        if (new_style) {
          assert.strictEqual(resp.reason, 'SyntaxError: Unexpected token Ș');
        } else {
          assert.strictEqual(resp.reason, 'malformed assertion');
        }
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
      "fails with a nice error": function(err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        if (new_style) {
          assert.strictEqual(resp.reason, 'verification failure');
        } else {
          assert.strictEqual(resp.reason, 'malformed assertion');
        }
      }
    }
  };

  var overall_test = {};
  overall_test[title] = tests;
  return overall_test;
}

suite.addBatch(make_crazy_assertion_tests(false));
suite.addBatch(make_crazy_assertion_tests(true));

// how about bogus parameters inside the assertion?
// now we only test the new assertion format, because
// for crazy stuff we don't really care about old format anymore
suite.addBatch({
  "An assertion that expired a millisecond ago": {
    topic: function()  {
      var expirationDate = new Date(new Date().getTime() - 10);
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      var assertion = vep.bundleCertsAndAssertion(
        [g_cert],
        tok.sign(g_keypair.secretKey),
        true);
      wsapi.post('/verify', {
        audience: TEST_ORIGIN,
        assertion: assertion
      }).call(this);
    },
    "fails with a nice error": function(err, r) {
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.status, 'failure');
      // XXX: the verifier should return a clearer error message
      assert.strictEqual(resp.reason, 'verification failure');
    }
  },
  "An assertion with a bundled bogus certificate": {
    topic: function()  {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      var assertion = vep.bundleCertsAndAssertion(
        [g_cert, "bogus cert"],
        tok.sign(g_keypair.secretKey),
        true);
      wsapi.post('/verify', {
        audience: TEST_ORIGIN,
        assertion: assertion
      }).call(this);
    },
    "fails with a nice error": function(err, r) {
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.status, 'failure');
      // XXX: this error should be clearer
      assert.strictEqual(resp.reason, 'Malformed JSON web signature: Must have three parts');
    }
  },
  "An assertion with a no certificate": {
    topic: function()  {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);

      // XXX this call throws an exception if it's new style
      // how to test this?
      var assertion = vep.bundleCertsAndAssertion(
        [],
        tok.sign(g_keypair.secretKey),
        false);
      wsapi.post('/verify', {
        audience: TEST_ORIGIN,
        assertion: assertion
      }).call(this);
    },
    "fails with a nice error": function(err, r) {
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.status, 'failure');
      // XXX: this error should be clearer
      assert.strictEqual(resp.reason, "TypeError: Cannot read property 'issuer' of undefined");
    }
  }
});

// now verify that assertions from a primary who does not have browserid support
// will fail to verify
function make_other_issuer_tests(new_style) {
  var title = "generating an assertion from a cert signed by some other domain with " + (new_style ? "new style" : "old style");
  var tests = {
    topic: function() {
      var fakeDomainKeypair = jwk.KeyPair.generate("RS", 64);
      var newClientKeypair = jwk.KeyPair.generate("DS", 256);
      expiration = new Date(new Date().getTime() + (1000 * 60 * 60 * 6));
      var cert = new jwcert.JWCert("no.such.domain", expiration, new Date(), newClientKeypair.publicKey,
                                   {email: TEST_EMAIL}).sign(fakeDomainKeypair.secretKey);

      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion([cert],
                                         tok.sign(newClientKeypair.secretKey),
                                         new_style);
    },
    "yields a good looking assertion": function (r) {
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
      "to return a clear error message": function (err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, "can't get public key for no.such.domain");
      }
    }
  };

  var overall_test = {};
  overall_test[title] = tests;
  return overall_test;
};

suite.addBatch(make_other_issuer_tests(false));
suite.addBatch(make_other_issuer_tests(true));

// now verify that assertions from a primary who does have browserid support
// but has no authority to speak for an email address will fail
suite.addBatch({
  "generating an assertion from a cert signed by a real (simulated) primary": {
    topic: function() {
      var secretKey = jwk.SecretKey.fromSimpleObject(
        JSON.parse(require('fs').readFileSync(
          path.join(__dirname, '..', 'example', 'primary', 'sample.privatekey'))));

      var newClientKeypair = jwk.KeyPair.generate("DS", 256);
      expiration = new Date(new Date().getTime() + (1000 * 60 * 60 * 6));
      var cert = new jwcert.JWCert("example.domain", expiration, new Date(), newClientKeypair.publicKey,
                                   {email: TEST_EMAIL}).sign(secretKey);

      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion([cert], tok.sign(newClientKeypair.secretKey));
    },
    "yields a good looking assertion": function (r) {
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
      "to return a clear error message": function (err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, "issuer issue 'example.domain' may not speak for emails from 'somedomain.com'");
      }
    }
  }
});

// now verify that assertions from a primary who does have browserid support
// and may speak for an email address will succeed
suite.addBatch({
  "generating an assertion from a cert signed by a real (simulated) primary": {
    topic: function() {
      var secretKey = jwk.SecretKey.fromSimpleObject(
        JSON.parse(require('fs').readFileSync(
          path.join(__dirname, '..', 'example', 'primary', 'sample.privatekey'))));

      var newClientKeypair = jwk.KeyPair.generate("DS", 256);
      expiration = new Date(new Date().getTime() + (1000 * 60 * 60 * 6));
      var cert = new jwcert.JWCert("example.domain", expiration, new Date(), newClientKeypair.publicKey,
                                   {email: "foo@example.domain"}).sign(secretKey);

      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var tok = new jwt.JWT(null, expirationDate, TEST_ORIGIN);
      return vep.bundleCertsAndAssertion([cert], tok.sign(newClientKeypair.secretKey));
    },
    "yields a good looking assertion": function (r) {
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
      "to return a clear error message": function (err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'okay');
        assert.strictEqual(resp.issuer, "example.domain");
        assert.strictEqual(resp.audience, TEST_ORIGIN);
        assert.strictEqual(resp.email, "foo@example.domain");
      }
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
