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
primary = require('./lib/primary.js');

var suite = vows.describe('password-length');

const TEST_DOMAIN = "example.domain",
      TEST_EMAIL = "test@" + TEST_DOMAIN,
      TEST_ORIGIN = 'http://127.0.0.1:10002';

var primaryUser = new primary({
  email: TEST_EMAIL,
  domain: TEST_DOMAIN
});

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

suite.addBatch({
  "address_info for an unknown address": {
     topic: wsapi.get('/wsapi/address_info', {
      email: TEST_EMAIL
     }),
    "returns unknown": function(e, r) {
      assert.isNull(e);
      var r = JSON.parse(r.body);
      assert.equal(r.type, "primary");
      assert.equal(r.state, "unknown");
      assert.isString(r.auth);
      assert.isString(r.prov);
    }
  }
});

// now let's generate an assertion using this user
suite.addBatch({
  "setting up a primary user": {
    topic: function() {
      primaryUser.setup(this.callback);
    },
    "and generating an assertion": {
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
        "succeeds": function(err, r) {
          var resp = JSON.parse(r.body);
          assert.isObject(resp);
          assert.isTrue(resp.success);
        }
      }
    }
  }
});

suite.addBatch({
  "address_info for an known primary address": {
     topic: wsapi.get('/wsapi/address_info', {
      email: TEST_EMAIL
     }),
    "returns known": function(e, r) {
      assert.isNull(e);
      console.log(r);
      var r = JSON.parse(r.body);
      assert.equal(r.type, "primary");
      assert.equal(r.state, "known");
      assert.isString(r.auth);
      assert.isString(r.prov);
    }
  }
});

// now manually fiddle email state in the database to
// test a transition_to_primary state
suite.addBatch({
  "setting type to secondary": {
    topic: function() {
      db.updateEmailLastUsedAs(TEST_EMAIL, 'secondary', this.callback);
    },
    "succeeds": function(e) {
      assert.isNull(e);
    }
  }
});

suite.addBatch({
  "address_info for an address transitioning to primary": {
     topic: wsapi.get('/wsapi/address_info', {
      email: TEST_EMAIL
     }),
    "returns transition_to_primary": function(e, r) {
      assert.isNull(e);
      console.log(r);
      var r = JSON.parse(r.body);
      assert.equal(r.type, "primary");
      assert.equal(r.state, "transition_to_primary");
      assert.isString(r.auth);
      assert.isString(r.prov);
    }
  }
});

// XXX: to test:
//  * transition_to_secondary (easyish)
//  * transition_no_password (easyish)
//  * offline (hardish)

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
