#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const
assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js');

var suite = vows.describe('simple-stage-user-utf8-password');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const
TEST_DOMAIN = 'example.domain',
TEST_ORIGIN = 'http://127.0.0.1:10002',
TEST_SITE = 'http://dev.123done.org';

// This test simply stages a secondary user. It does so for two users,
// one with a password that is only ascii, and the other with non-ascii
// characters in the password (GH-1631).

const test_users =
  [{
    email: 'testuser1@' + TEST_DOMAIN,
    password: 'fakepass',
  },
  {
    email: 'testuser2@' + TEST_DOMAIN,
    password: 'поддельный пароль', // Russian 'fake password' (34 bytes UTF-8)
  }];

function makeBatch(site, user) {
  var batch = {
    "staging an account": {
      topic: wsapi.post('/wsapi/stage_user', {
        site: site,
        email: user.email,
        pass: user.password,
      }),
      "is 200 OK": function(err, r) {
        assert.strictEqual(r.code, 200);
      },
      "and a token": {
        topic: function() {
          start_stop.waitForToken(this.callback);
        },
        "is obtained": function (t) {
          assert.strictEqual(typeof t, 'string');
        },
        "and the token can be used": {
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
  };
  return batch;
}

suite.addBatch(makeBatch(TEST_SITE, test_users[0]));
suite.addBatch(makeBatch(TEST_SITE, test_users[1]));

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
