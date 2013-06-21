#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This tests excercises address_info and attempt to excercise all
 * possible response values from it.  */

require('./lib/test_env.js');

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
db = require('../lib/db.js'),
primary = require('./lib/primary.js');
config = require('../lib/configuration.js'),
bcrypt = require('bcrypt'),
primary = require('./lib/primary.js'),
secondary = require('./lib/secondary.js'),
util = require('util'),
path = require('path');

var suite = vows.describe('password-length');

const TEST_DOMAIN = "example.domain",
      TEST_EMAIL = "test@" + TEST_DOMAIN,
      TEST_ORIGIN = 'http://127.0.0.1:10002';

const SECONDARY_TEST_EMAIL = "test@example.com";

// an explicitly disabled domain
process.env['SHIMMED_PRIMARIES'] =
  util.format("disabled.domain|http://127.0.0.1:10005|%s", path.join(__dirname, 'data',
    'disabled.domain', '.well-known', 'browserid'));

var primaryUser = new primary({
  email: TEST_EMAIL,
  domain: TEST_DOMAIN
});

var token;

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

// set up address for transition
suite.addBatch({
  "creating a secondary user": {
     topic: function() {
       secondary.create({ email: "foo@example.com" }, this.callback);
     },
    "works": function(e, r) {
      assert.isNull(e);
    },
    "setting type to primary": {
      topic: function() {
        db.updateEmailLastUsedAs("foo@example.com", 'primary', this.callback);
      },
      "succeeds": function(e) {
        assert.isNull(e);
      },
      "and calling address info": {
        topic: wsapi.get('/wsapi/address_info', {
          email: "foo@example.com"
        }),
        "shows 'transition_no_password'": function(err, r) {
          assert.isNull(err);
          var r = JSON.parse(r.body);
          assert.equal(r.type, "secondary");
          assert.equal(r.state, "transition_to_secondary");
        }
      }
    }
  }
});

// Run the forgot password flow with the address.
suite.addBatch({
  "stage transition": {
    topic: wsapi.post('/wsapi/stage_reset', {
      email: 'foo@example.com',
      site:'https://otherfakesite.com'
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  }
});

// wait for the token
suite.addBatch({
  "a token": {
    topic: function() {
      start_stop.waitForToken(this.callback);
    },
    "is obtained": function (err, t) {
      assert.isNull(err);
      assert.strictEqual(typeof t, 'string');
      token = t;
    }
  }
});

suite.addBatch({
  "given a token, getting an email": {
    topic: function() {
      wsapi.get('/wsapi/email_for_token', { token: token }).call(this);
    },
    "returns success": function(err, r) {
      assert.equal(r.code, 200);
      var body = JSON.parse(r.body);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.must_auth, false);
    }
  }
});

suite.addBatch({
  "transition status": {
    topic: wsapi.get('/wsapi/transition_status', { email: 'foo@example.com' } ),
    "returns 'pending' before calling complete": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).status, "pending");
    }
  }
});

// now let's complete the re-registration of first email address
suite.addBatch({
  "complete transition": {
    topic: function() {
      wsapi.post('/wsapi/complete_reset', {
        token: token,
        pass: 'password'
      }).call(this);
    },
    "password reset": function(err, r) {
      assert.equal(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).success, true);
    },
    "transition status": {
      topic: wsapi.get('/wsapi/transition_status', { email: 'foo@example.com' } ),
      "returns 'complete' before calling reset": function(err, r) {
        assert.strictEqual(r.code, 200);
        assert.strictEqual(JSON.parse(r.body).status, "complete");
      }
    },
    "email type and state updated": {
      topic: wsapi.get('/wsapi/address_info', { email: 'foo@example.com' } ),
      "updates email's type to secondary, state to known": function(err, r) {
        assert.strictEqual(r.code, 200);
        var body = JSON.parse(r.body);
        assert.strictEqual(body.type, "secondary");
        assert.strictEqual(body.state, "known");
      }
    }
  }
});

// now we should be able to sign in with the password
suite.addBatch({
  "secondary account": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: 'foo@example.com',
      pass: 'password',
      ephemeral: false
    }),
    "should work": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
