#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* testing that we are properly recording to the database when
 * primary .well-known documents are fetched and well formed,
 * which is required by features that help users understand why
 * their UX changes when their email provider decided to implement
 * (or disable) persona support */

require('./lib/test_env.js');

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
db = require('../lib/db.js'),
primary = require('./lib/primary.js');
config = require('../lib/configuration.js'),
bcrypt = require('bcrypt');

var suite = vows.describe('password-length');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_DOMAIN = "example.domain";
const TEST_ORIGIN = 'http://127.0.0.1:10002';

var primaryUser = new primary({
  email: "test@example.domain",
  domain: TEST_DOMAIN
});

suite.addBatch({
  "initializing a primary user": {
    topic: function() {
      primaryUser.setup(this.callback);
    },
    "works": function() {
      // nothing to do here
    }
  }
});

suite.addBatch({
  "at startup": {
    topic: function() {
      db.getIDPLastSeen(TEST_DOMAIN, this.callback);
    },
    "no entry for example.domain is in the db": function(err, seen) {
      assert.isNull(err);
      assert.isNull(seen);
    }
  }
});

// first test that browserid properly updates the db when IDPs are seen
suite.addBatch({
  "getting address info for a delegated domain": {
     topic: wsapi.get('/wsapi/address_info', {
      email: 'test@delegated.domain'
    }),
    "works": function(e, r) {
      assert.isNull(e);
      assert(r);
      assert(r.body);
      var respBody = JSON.parse(r.body);
      assert.equal(respBody.type, "primary");
    },
    "after a short wait": {
      topic: function() {
        setTimeout(this.callback, 500);
      },
      "causes the principle domain": {
        topic: function() {
          db.getIDPLastSeen("delegated.domain", this.callback);
        },
        "to be recorded as a seen IdP": function(err, seen) {
          assert.isNull(err);
          var delta = new Date() - seen;
          assert(delta > 0, "the IDP has been seen");
          assert(delta < 5000, "the IDP was seen less than 5 seconds ago");
        }
      }
    }
  }
});

// now test dbwriter properly updates the db when IDPs are seen
suite.addBatch({
  "generating an assertion": {
    topic: function() {
      primaryUser.getAssertion(TEST_ORIGIN, this.callback);
    },
    "works": function(err, r) {
      assert.isString(r);
    },
    "logging in with the assertion": {
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
      "causes": {
        topic: function() {
          db.getIDPLastSeen(TEST_DOMAIN, this.callback);
        },
        "db to be updated with an entry for example.domain": function(err, seen) {
          assert.isNull(err);
          var delta = new Date() - seen;
          assert(delta > 0, "the IDP has been seen");
          assert(delta < 5000, "the IDP was seen less than 5 seconds ago");
        }
      }
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
