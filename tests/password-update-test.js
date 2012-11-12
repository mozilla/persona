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
config = require('../lib/configuration.js');

var suite = vows.describe('password-length');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_EMAIL = 'someuser@somedomain.com',
      OLD_PASSWORD = 'thisismyoldpassword',
      NEW_PASSWORD = 'thisismynewpassword';

// surpress console output of emails with a noop email interceptor
var token = undefined;

// first stage the account
suite.addBatch({
  "account staging": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD,
      site: 'https://fakesite.com:123'
    }),
    "works":     function(err, r) {
      assert.equal(r.code, 200);
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

// create a new account via the api with (first address)
suite.addBatch({
  "setting password": {
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

suite.addBatch({
  "authenticating with the password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD,
      ephemeral: false
    }),
    "works as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  },
  "authenticating with the wrong password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: NEW_PASSWORD,
      ephemeral: false
    }),
    "fails as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  }
});

var context2 = {};
suite.addBatch({
  "establishing a second session": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD,
      ephemeral: false
    }, context2),
    "works as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

suite.addBatch({
  "using the second session": {
    topic: wsapi.post('/wsapi/prolong_session', {}, context2),
    "works as expected": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.body, "OK");
    }
  }
});

suite.addBatch({
  "updating the password without specifying a proper old password": {
    topic: wsapi.post('/wsapi/update_password', {
      oldpass: "bogus ass password",
      newpass: NEW_PASSWORD
    }),
    "fails as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  }
});

suite.addBatch({
  "updating the password with a bogus new password": {
    topic: wsapi.post('/wsapi/update_password', {
      oldpass: OLD_PASSWORD,
      newpass: 'bogus' // too short
    }),
    "fails as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  }
});

suite.addBatch({
  "after waiting for lastPasswordReset's now() to increment": {
    topic: function() {
      // we introduce a 2s delay here to ensure that the now() call in
      // lib/db/{json,mysql}.js will return a different value than it did
      // during complete_user_creation(), thus expiring the old session still
      // hanging out in context2. now() returns an integer
      // seconds-since-epoch, so the shortest delay that will reliably get a
      // different result is 1.0s+epsilon (depending upon the resolution of
      // the system clock). To avoid this stall (and make the test suite run
      // 2s faster), either:
      //  1: change now() to include a mutable offset, expose a
      //     db.addNowOffset() to "accelerate the universe", have this code
      //     add 1s instead of using setTimeout. Or:
      //  2: add a db function to modify (increment) lastPasswordReset by 1s,
      //     have this code call it instead of using setTimeout
      setTimeout(this.callback, 2000);
      },
    "updating the password": {
      topic: wsapi.post('/wsapi/update_password', {
        oldpass: OLD_PASSWORD,
        newpass: NEW_PASSWORD
      }),
      "works as expected": function(err, r) {
        assert.strictEqual(JSON.parse(r.body).success, true);
      }
    }
  }
});

suite.addBatch({
  "authenticating with the password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: NEW_PASSWORD,
      ephemeral: false
    }),
    "works as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  },
  "authenticating with the wrong password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD,
      ephemeral: false
    }),
    "fails as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  },
  "using the other (expired) session": {
    topic: wsapi.post('/wsapi/prolong_session', {}, context2),
    "fails as expected": function(err, r) {
      assert.strictEqual(r.code, 403);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
