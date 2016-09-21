#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

process.env.PROXY_IDPS = '{"yahoo.com": "bigtent.domain"}';

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
db = require('../lib/db.js'),
config = require('../lib/configuration.js'),
http = require('http'),
querystring = require('querystring'),
path = require('path'),
primary = require('./lib/primary.js'),
jwcrypto = require('jwcrypto');

var suite = vows.describe('auth-with-assertion');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_DOMAIN = 'example.domain',
      TEST_EMAIL = 'testuser@' + TEST_DOMAIN,
      SECOND_TEST_EMAIL = 'testusertoo@' + TEST_DOMAIN,
      TEST_PASSWORD = 'TestingMcTestTest',
      TEST_ORIGIN = 'http://127.0.0.1:10002',
      OTHER_EMAIL = 'otheruser@' + TEST_DOMAIN;


// here we go!  let's authenticate with an assertion from
// a primary.

var primaryUser = new primary({
  email: TEST_EMAIL,
  domain: TEST_DOMAIN
});

var primaryUser2 = new primary({
  email: SECOND_TEST_EMAIL,
  domain: TEST_DOMAIN
});

suite.addBatch({
  "set up the first primary user": {
    topic: function () {
      primaryUser.setup(this.callback);
    },
    "works": function () {
      // nothing to do here
    }
  },
  "set up the second primary user": {
    topic: function () {
      primaryUser2.setup(this.callback);
    },
    "works": function () {
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
    "and logging in with the assertion": {
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

// next, let's verify that auth_with_assertion properly update
// `lastUsedAs`
suite.addBatch({
  "setting lastUsedAs to secondary": {
    topic: function(err, certs_and_assertion) {
      db.updateEmailLastUsedAs(TEST_EMAIL, 'secondary', this.callback);
    },
    "works": function (err, lastUsedAs) {
      assert.isNull(err);
    },
    "then generating an assertion": {
      topic: function() {
        primaryUser.getAssertion(TEST_ORIGIN, this.callback);
      },
      "succeeds": function(err, r) {
        assert.isString(r);
      },
      "and logging in with the assertion": {
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
        },
        "and after a moment": {
          topic: function() {
            setTimeout(this.callback, 500);
          },
          "lastUsedAs": {
            topic: function() {
              db.emailLastUsedAs(TEST_EMAIL, this.callback);
            },
            "is set back to 'primary'": function(err, r) {
              assert.isNull(err);
              assert.equal(r, 'primary');
            }
          }
        }
      }
    }
  }
});

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
            {publicKey: innerKeypair.publicKey, principal: {email: OTHER_EMAIL}},
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

const BT_DOMAIN = 'bigtent.domain',
      BT_EMAIL = 'sita@yahoo.com',
      BT_PRIV_KEY = jwcrypto.loadSecretKey(
        require('fs').readFileSync(
          path.join(__dirname, '..', 'example', 'bigtent', 'key.secretkey')));

var bigTentUser;

suite.addBatch({
  "generating an assertion": {
    topic: function () {
      bigTentUser = new primary({
        email: BT_EMAIL,
        domain: BT_DOMAIN,
        privKey: BT_PRIV_KEY
      });
      bigTentUser.setup(this.callback);
    },
    "works":  {
      topic: function () {
        bigTentUser.getAssertion(TEST_ORIGIN, this.callback, 'bigtent.domain');
      },
      "succeeds": function (err, r) {
        assert.isString(r);
      },
      "and logging in with the assertion succeeds": {
        topic: function (err, assertion) {
          wsapi.post('/wsapi/auth_with_assertion', {
            assertion: assertion,
            ephemeral: true
          }).call(this);
        },
        "works": function (err, r) {
          var resp = JSON.parse(r.body);
          assert.isObject(resp);
          assert.isTrue(resp.success);
        }
      }
    }
  }
});

suite.addBatch({
  "creating an unverified user account for this email": {
    topic: function () {
      // We first have to delete the email
      // so we can re-create as a fresh account.
      var cb = this.callback.bind(this);
      db.emailToUID(TEST_EMAIL, function (err, uid) {
        if (err) { return this.callback(err); }
        db.cancelAccount(uid, function (err) {
          if (err) { return this.callback(err); }
          wsapi.post('/wsapi/stage_user', {
            email: TEST_EMAIL,
            pass: TEST_PASSWORD,
            site: TEST_ORIGIN,
            allowUnverified: true
          }, null, function (err, r) {
            db.emailToUID(TEST_EMAIL, function (err, uid) {
              cb(err, r, uid);
            });
          }).call(this);
        });
      });
    },
    "works": function (err, r, unverifiedUid) {
      assert.isNull(err);
      var resp = JSON.parse(r.body);
      assert.isObject(resp);
      assert.isTrue(resp.success);
      assert.ok(unverifiedUid);
    },
    "then logging in with the password": {
      topic: function () {
        wsapi.post('/wsapi/authenticate_user', {
          email: TEST_EMAIL,
          pass: TEST_PASSWORD,
          ephemeral: true,
          allowUnverified: true
        }).call(this);
      },
      "works": function (err, r) {
        assert.isNull(err);
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.isTrue(resp.success);
      }
    },
    "then generating an assertion": {
      topic: function (err, r, unverifiedUid) {
        var cb = this.callback.bind(this);
        primaryUser.getAssertion(TEST_ORIGIN, function (err, assertion) {
          cb(err, unverifiedUid, assertion);
        });
      },
      "succeeds": function (err, unverifiedUid, assertion) {
        assert.isNull(err);
        assert.isString(assertion);
      },
      "and logging in with that assertion": {
        topic: function (err, unverifiedUid, assertion)  {
          var cb = this.callback.bind(this);
          wsapi.post('/wsapi/auth_with_assertion', {
            assertion: assertion,
            ephemeral: true
          }, null, function (err, r) {
            cb(err, unverifiedUid, r);
          }).call(this);
        },
        "works": function (err, unverifiedUid, r) {
          var resp = JSON.parse(r.body);
          assert.isObject(resp);
          assert.isTrue(resp.success);
          assert.ok(resp.userid);
        },
        "logs the user in with a fresh uid": function (err, unverifiedUid, r) {
          var resp = JSON.parse(r.body);
          assert.notEqual(unverifiedUid, resp.userid);
        },
        "then trying to login with the original password": {
          topic: function () {
            wsapi.post('/wsapi/authenticate_user', {
              email: TEST_EMAIL,
              pass: TEST_PASSWORD,
              ephemeral: true,
              allowUnverified: true
            }).call(this);
          },
          "fails with a password error": function (err, r) {
            assert.isNull(err);
            var resp = JSON.parse(r.body);
            assert.isObject(resp);
            assert.isFalse(resp.success);
            assert.equal(resp.reason, 'no password set for user');
          }
        },
        "then generating an assertion for a second primary email": {
          topic: function () {
            var cb = this.callback.bind(this);
            primaryUser2.getAssertion(TEST_ORIGIN, function (err, assertion) {
              cb(err, assertion);
            });
          },
          "succeeds": function (err, assertion) {
            assert.isNull(err);
            assert.isString(assertion);
          },
          "and using it to add another primary email to the account": {
            topic: function (err, assertion)  {
              wsapi.post('/wsapi/add_email_with_assertion', {
                assertion: assertion,
              }).call(this);
            },
            "works": function (err, r) {
              var resp = JSON.parse(r.body);
              assert.isObject(resp);
              assert.isTrue(resp.success);
            },
            "then listing all emails on the account": {
              topic: function (err, assertion)  {
                wsapi.get('/wsapi/list_emails').call(this);
              },
              "works": function (err, r) {
                assert.isNull(err);
                var resp = JSON.parse(r.body);
                assert.isObject(resp);
                assert.isTrue(resp.success);
                assert.ok(resp.emails);
              },
              "shows both of the emails on the account": function (err, r) {
                var emails = JSON.parse(r.body).emails;
                assert.equal(emails.length, 2);
                assert.ok(emails.indexOf(TEST_EMAIL) >= 0);
                assert.ok(emails.indexOf(SECOND_TEST_EMAIL) >= 0);
              }
            },
            "then loging in to the second email with the original password": {
              topic: function () {
                wsapi.post('/wsapi/authenticate_user', {
                  email: SECOND_TEST_EMAIL,
                  pass: TEST_PASSWORD,
                  ephemeral: true,
                  allowUnverified: true
                }).call(this);
              },
              "fails with a password error": function (err, r) {
                assert.isNull(err);
                var resp = JSON.parse(r.body);
                assert.isObject(resp);
                assert.isFalse(resp.success);
                assert.equal(resp.reason, 'no password set for user');
              }
            }
          }
        }
      }
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
