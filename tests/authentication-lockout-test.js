#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// set authentication lockout low so we can test it easier
process.env['MAX_AUTH_ATTEMPTS'] = 3;

require('./lib/test_env.js');

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
config = require('../lib/configuration.js'),
secondary = require('./lib/secondary.js');

var suite = vows.describe('password-length');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_EMAIL = 'someuser@somedomain.com',
      OLD_PASSWORD = 'thisismyoldpassword',
      NEW_PASSWORD = 'thisismynewpassword';

// surpress console output of emails with a noop email interceptor
var token = undefined;

// create a new secondary account
suite.addBatch({
  "creating a secondary account": {
    topic: function() {
      secondary.create({
        email: TEST_EMAIL,
        pass: OLD_PASSWORD,
        site: 'https://fakesite.com:123'
      }, this.callback);
    },
    "succeeds": function(err, r) {
      assert.isNull(err);
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
  }
});

suite.addBatch({
  "authenticating with the wrong password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: NEW_PASSWORD,
      ephemeral: false
    }),
    "fails as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    },
    "and again with the wrong password": {
      topic: wsapi.post('/wsapi/authenticate_user', {
        email: TEST_EMAIL,
        pass: NEW_PASSWORD,
        ephemeral: false
      }),
      "fails again": function(err, r) {
        assert.strictEqual(JSON.parse(r.body).success, false);
      },
      "and a third time with the wrong password": {
        topic: wsapi.post('/wsapi/authenticate_user', {
          email: TEST_EMAIL,
          pass: NEW_PASSWORD,
          ephemeral: false
        }),
        "still fails": function(err, r) {
          assert.strictEqual(JSON.parse(r.body).success, false);
          assert.strictEqual(JSON.parse(r.body).reason,
                             "password mismatch for user: someuser@somedomain.com");
        },
        "and we wait to let asynchronous increments": {
          topic: function() {
            setTimeout(this.callback, 200);
          },
          "complete": function() {
            // ... at this point all increments are complete.
            // the account should be locked, we'll test below
          }
        }
      }
    }
  }
});

suite.addBatch({
  "after too many failures, authentication": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD,
      ephemeral: false
    }),
    "fails": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    },
    "returns an 'account locked' error code": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).code, 'account locked');
    }
  }
});

// now let's reset our password via the 'forgot password' flow and
// verify that we're unlocked.
suite.addBatch({
  "reseting password": {
    topic: wsapi.post('/wsapi/stage_reset', {
      email: TEST_EMAIL,
      site:'https://otherfakesite.com'
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "and getting a token": {
      topic: function() {
        start_stop.waitForToken(this.callback);
      },
      "succeeds": function (err, t) {
        assert.isNull(err);
        assert.strictEqual(typeof t, 'string');
        token = t;
      },
      "and completing password reset": {
        topic: function() {
          wsapi.post('/wsapi/complete_reset', {
            pass: NEW_PASSWORD,
            token: token
          }).call(this);
        },
        "account created": function(err, r) {
          assert.equal(r.code, 200);
          assert.strictEqual(JSON.parse(r.body).success, true);
        }
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
  }
});

// great!  Finally, let's test that a sucessful authentication resets the
// failure count.
suite.addBatch({
  "authenticating with the wrong password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD,
      ephemeral: false
    }),
    "fails as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    },
    "twice": {
      topic: wsapi.post('/wsapi/authenticate_user', {
        email: TEST_EMAIL,
        pass: OLD_PASSWORD,
        ephemeral: false
      }),
      "fails as expected": function(err, r) {
        assert.strictEqual(JSON.parse(r.body).success, false);
      }
    }
  }
});

// now a good authentication succeeds
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
  }
});

// we assume that reset our failure count, let's fail twice more
// great!  Finally, let's test that a sucessful authentication resets the
// failure count.
suite.addBatch({
  "authenticating with the wrong password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD,
      ephemeral: false
    }),
    "fails as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    },
    "twice": {
      topic: wsapi.post('/wsapi/authenticate_user', {
        email: TEST_EMAIL,
        pass: OLD_PASSWORD,
        ephemeral: false
      }),
      "fails as expected": function(err, r) {
        assert.strictEqual(JSON.parse(r.body).success, false);
      }
    }
  }
});

// even after that, good authentication still succeeds
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
  }
});


start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
