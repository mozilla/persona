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
jwcrypto = require('jwcrypto'),
http = require('http'),
querystring = require('querystring'),
path = require('path');

var suite = vows.describe('verifier');

require("jwcrypto/lib/algs/rs");
require("jwcrypto/lib/algs/ds");

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
      jwcrypto.generateKeypair({algorithm: "DS", keysize: 256}, this.callback);
    },
    "succeeds": function(err, r) {
      assert.isNull(err);
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
      var self = this;
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                             g_keypair.secretKey, function(err, assertion) {
                               if (err) return self.callback(err);
                               var b = jwcrypto.cert.bundle([g_cert],
                                                            assertion,
                                                            new_style); // XXX IGNORED
                               self.callback(null, b);
                             });
    },
    "succeeds": function(err, r) {
      assert.isString(r);
    },
    "and verifying that assertion by specifying domain as audience": {
      topic: function(err, assertion)  {
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
      topic: function(err, assertion)  {
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
      topic: function(err, assertion)  {
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
      topic: function(err, assertion)  {
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
      topic: function(err, assertion)  {
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
      topic: function(err, assertion)  {
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
      topic: function(err, assertion)  {
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
      topic: function(err, assertion)  {
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
      topic: function(err, assertion)  {
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
      var self = this;
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                             g_keypair.secretKey, function(err, assertion) {
                               if (err) return self.callback(err);
                               var b = jwcrypto.cert.bundle([g_cert],
                                                            assertion,
                                                            new_style); // XXX IGNORED
                               self.callback(null, b);
                             });
    },
    "succeeds": function(err, r) {
      assert.isString(r);
    },
    "posting assertion and audience as get parameters in a post request": {
      topic: function(err, assertion)  {
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
      topic: function(err, assertion)  {
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
      topic: function(err, assertion)  {
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
      var self = this;
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                             g_keypair.secretKey, function(err, assertion) {
                               if (err) return self.callback(err);
                               var b = jwcrypto.cert.bundle([g_cert],
                                                            assertion,
                                                            new_style); // XXX IGNORED
                               self.callback(null, b);
                             });
    },
    "succeeds": function(err, r) {
      assert.isString(r);
    },
    "and submitting without proper Content-Type headers": {
      topic: function(err, assertion)  {
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
      topic: function(err, assertion)  {
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

var fakeDomainKeypair, newClientKeypair;

// let's reuse the keys, cause we don't need new ones.
suite.addBatch({
  "set up fake domain key": {
    topic: function() {
      jwcrypto.generateKeypair({algorithm: "RS", keysize: 64}, this.callback);
    },
    "works": function(err, kp) {
      assert.isNull(err);
      assert.isObject(kp);
      fakeDomainKeypair = kp;
    }
  }
});

suite.addBatch({
  "set up user key": {
    topic: function() {
      jwcrypto.generateKeypair({algorithm: "DS", keysize: 256}, this.callback);
    },
    "works": function(err, kp) {
      assert.isNull(err);
      assert.isObject(kp);
      newClientKeypair = kp;
    }
  }
});

var fakeCert;
suite.addBatch({
  "certify the user key": {
    topic: function() {
      var expiration = new Date(new Date().getTime() + (1000 * 60 * 60 * 6));
      jwcrypto.cert.sign(newClientKeypair.publicKey, {email: TEST_EMAIL},
                         {issuedAt: new Date(), issuer: "127.0.0.1",
                          expiresAt: expiration},
                         {}, fakeDomainKeypair.secretKey, this.callback);
    },
    "works": function(err, cert) {
      assert.isNull(err);
      assert.isString(cert);
      fakeCert = cert;
    }
  }
});



// now verify that a incorrectly signed assertion yields a good error message
function make_incorrect_assertion_tests(new_style) {
  var title = "generating an assertion from a bogus cert with " + (new_style? "new style" : "old style");
  var tests = {
    topic: function() {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var self = this;
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                             newClientKeypair.secretKey, function(err, assertion) {
                               if (err) return self.callback(err);
                               var b = jwcrypto.cert.bundle([fakeCert],
                                                            assertion,
                                                            new_style); // XXX IGNORED
                               self.callback(null, b);
                             });
    },
    "yields a good looking assertion": function (err, r) {
      assert.isString(r);
      assert.equal(r.length > 0, true);
    },
    "will cause the verifier": {
      topic: function(err, assertion) {
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
      // the error message here will be that there are no certs
      assert.strictEqual(resp.reason, 'no certificates provided');
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
      // this error message has to do with the full (backed) assertion not looking
      // like a bundle of certs and assertion
      assert.strictEqual(resp.reason, 'malformed backed assertion');
    }
  }
});

function make_crazy_assertion_tests(new_style) {
  var title = "generating a valid assertion with " + (new_style ? "new style" : "old style");
  var tests = {
    topic: function()  {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var self = this;
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                             g_keypair.secretKey, function(err, assertion) {
                               if (err) return self.callback(err);
                               var b = jwcrypto.cert.bundle([g_cert],
                                                            assertion,
                                                            new_style); // XXX IGNORED
                               self.callback(null, b);
                             });
    },
    "and removing the last two chars from it": {
      topic: function(err, assertion) {
        // we used to chop off one char, but because of
        // robustness in base64-decoding, that still worked 25%
        // of the time. No need to build this knowledge in here.
        // also, chopping off 2 characters gives varying error messages
        assertion = assertion.substr(0, assertion.length - 2);
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "fails with a nice error": function(err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');

        // so depending on the assertion, this is going to be invalid or malformed
        // so we're not testing the error message for now
        // assert.strictEqual(resp.reason, 'invalid signature');
      }
    },
    "and removing the first char from it": {
      topic: function(err, assertion) {
        assertion = assertion.substr(1);
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "fails with a nice error": function(err, r) {
        // XXX this test is failing because there's an exception thrown
        // that's revealing too much info about the malformed signature
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'malformed signature');
      }
    },
    "and appending gunk to it": {
      topic: function(err, assertion) {
        assertion += "gunk";
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "fails with a nice error": function(err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, 'malformed signature');
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
      var self = this;
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                             g_keypair.secretKey, function(err, assertion) {
                               if (err) return self.callback(err);
                               var b = jwcrypto.cert.bundle([g_cert],
                                                            assertion,
                                                            true); // XXX IGNORED
                               
                               wsapi.post('/verify', {
                                 audience: TEST_ORIGIN,
                                 assertion: b
                               }).call(self);
                             });
    },
    "fails with a nice error": function(err, r) {
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.status, 'failure');
      assert.strictEqual(resp.reason, 'assertion has expired');
    }
  },
  "An assertion with a bundled bogus certificate": {
    topic: function()  {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var self = this;
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                             g_keypair.secretKey, function(err, assertion) {
                               if (err) return self.callback(err);
                               var b = jwcrypto.cert.bundle([g_cert, "bogus cert"],
                                                            assertion,
                                                            true); // XXX IGNORED
                               
                               wsapi.post('/verify', {
                                 audience: TEST_ORIGIN,
                                 assertion: b
                               }).call(self);
                             });
    },
    "fails with a nice error": function(err, r) {
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.status, 'failure');
      assert.strictEqual(resp.reason, 'malformed signature');
    }
  },
  "An assertion with a no certificate": {
    topic: function()  {
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var self = this;
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                             g_keypair.secretKey, function(err, assertion) {
                               if (err) return self.callback(err);

                               // a bundle with no certs is no longer possible,
                               // so we submit just the assertion
                               
                               wsapi.post('/verify', {
                                 audience: TEST_ORIGIN,
                                 assertion: assertion
                               }).call(self);
                             });
    },
    "fails with a nice error": function(err, r) {
      var resp = JSON.parse(r.body);
      assert.strictEqual(resp.status, 'failure');
      // an error that indicates no certs
      assert.strictEqual(resp.reason, "no certificates provided");
    }
  }
});

var otherIssuerCert;

suite.addBatch({
  "certify the user key for other issuer": {
    topic: function() {
      var expiration = new Date(new Date().getTime() + (1000 * 60 * 60 * 6));
      jwcrypto.cert.sign(newClientKeypair.publicKey, {email: TEST_EMAIL},
                         {issuedAt: new Date(), issuer: "no.such.domain",
                          expiresAt: expiration},
                         {}, fakeDomainKeypair.secretKey, this.callback);
    },
    "works": function(err, cert) {
      assert.isNull(err);
      assert.isString(cert);
      otherIssuerCert = cert;
    }
  }
});


// now verify that assertions from a primary who does not have browserid support
// will fail to verify
function make_other_issuer_tests(new_style) {
  var title = "generating an assertion from a cert signed by some other domain with " + (new_style ? "new style" : "old style");
  var tests = {
    topic: function() {
      // keys are already generated
      // otherIssuerCert is already generated
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var self = this;
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                             newClientKeypair.secretKey, function(err, assertion) {
                               if (err) return self.callback(err);
                               var b = jwcrypto.cert.bundle([otherIssuerCert],
                                                            assertion,
                                                            new_style); // XXX IGNORED
                               self.callback(null, b);
                             });
    },
    "yields a good looking assertion": function (err, r) {
      assert.isString(r);
      assert.equal(r.length > 0, true);
    },
    "will cause the verifier": {
      topic: function(err, assertion) {
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

// prepare a cert with example.domain primary
var primaryCert;
suite.addBatch({
  "certify the user key by example.domain for wrong email address": {
    topic: function() {
      var secretKey = jwcrypto.loadSecretKey(
        require('fs').readFileSync(
          path.join(__dirname, '..', 'example', 'primary', 'sample.privatekey')));

      var expiration = new Date(new Date().getTime() + (1000 * 60 * 60 * 6));
      jwcrypto.cert.sign(newClientKeypair.publicKey, {email: TEST_EMAIL},
                         {issuedAt: new Date(), issuer: "example.domain",
                          expiresAt: expiration},
                         {}, secretKey, this.callback);
    },
    "works": function(err, cert) {
      assert.isNull(err);
      assert.isString(cert);
      primaryCert = cert;
    }
  }
});

// now verify that assertions from a primary who does have browserid support
// but has no authority to speak for an email address will fail
suite.addBatch({
  "generating an assertion from a cert signed by a real (simulated) primary": {
    topic: function() {
      // newClientKeypair already generated, reusing
      // primaryCert already generated
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var self = this;
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                             newClientKeypair.secretKey, function(err, assertion) {
                               if (err) return self.callback(err);
                               var b = jwcrypto.cert.bundle([primaryCert],
                                                            assertion);
                               self.callback(null, b);
                             });
    },
    "yields a good looking assertion": function (err, r) {
      assert.isString(r);
      assert.equal(r.length > 0, true);
    },
    "will cause the verifier": {
      topic: function(err, assertion) {
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "to return a clear error message": function (err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, "issuer 'example.domain' may not speak for emails from 'somedomain.com'");
      }
    }
  }
});

suite.addBatch({
  "certify the user key by example.domain for right email address": {
    topic: function() {
      var secretKey = jwcrypto.loadSecretKey(
        require('fs').readFileSync(
          path.join(__dirname, '..', 'example', 'primary', 'sample.privatekey')));

      var expiration = new Date(new Date().getTime() + (1000 * 60 * 60 * 6));
      jwcrypto.cert.sign(newClientKeypair.publicKey, {email: "foo@example.domain"},
                         {issuedAt: new Date(), issuer: "example.domain",
                          expiresAt: expiration},
                         {}, secretKey, this.callback);
    },
    "works": function(err, cert) {
      assert.isNull(err);
      assert.isString(cert);
      primaryCert = cert;
    }
  }
});

// now verify that assertions from a primary who does have browserid support
// and may speak for an email address will succeed
suite.addBatch({
  "generating an assertion from a cert signed by a real (simulated) primary": {
    topic: function() {
      // primaryCert generated
      // newClientKeypair generated
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var self = this;
      jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                             newClientKeypair.secretKey, function(err, assertion) {
                               if (err) return self.callback(err);
                               var b = jwcrypto.cert.bundle([primaryCert],
                                                            assertion);
                               self.callback(null, b);
                             });
    },
    "yields a good looking assertion": function (err, r) {
      assert.isString(r);
      assert.equal(r.length > 0, true);
    },
    "will cause the verifier": {
      topic: function(err, assertion) {
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "to succeed": function (err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'okay');
        assert.strictEqual(resp.issuer, "example.domain");
        assert.strictEqual(resp.audience, TEST_ORIGIN);
        assert.strictEqual(resp.email, "foo@example.domain");
      }
    }
  }
});

const OTHER_EMAIL = 'otheremail@example.com';

// check that chained certs do not work
suite.addBatch({
  "generating an assertion with chained certs": {
    topic: function() {
      // primaryCert generated
      // newClientKeypair generated
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var self = this;

      jwcrypto.generateKeypair(
        {algorithm: "DS", keysize: 256},
        function(err, innerKeypair) {

          // sign this innerkeypair with the key from g_cert (g_keypair)
          jwcrypto.cert.sign(
            innerKeypair.publicKey, {email: OTHER_EMAIL},
            {issuedAt: new Date(), expiresAt: expirationDate},
            {}, g_keypair.secretKey,
            function(err, innerCert) {
              jwcrypto.assertion.sign({}, {audience: TEST_ORIGIN, expiresAt: expirationDate},
                                      innerKeypair.secretKey, function(err, assertion) {
                                        if (err) return self.callback(err);
                                        
                                        var b = jwcrypto.cert.bundle([g_cert, innerCert],
                                                                     assertion);
                                        self.callback(null, b);
                                      });
            });
          
        });
    },
    "yields a good looking assertion": function (err, assertion) {
      assert.isString(assertion);
      assert.equal(assertion.length > 0, true);
    },
    "will cause the verifier": {
      topic: function(err, assertion) {
        wsapi.post('/verify', {
          audience: TEST_ORIGIN,
          assertion: assertion
        }).call(this);
      },
      "to fail": function (err, r) {
        var resp = JSON.parse(r.body);
        assert.strictEqual(resp.status, 'failure');
        assert.strictEqual(resp.reason, "certificate chaining is not yet allowed");
      }
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
