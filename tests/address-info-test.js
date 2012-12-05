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
      assert.equal(r.issuer, TEST_DOMAIN);
      assert.equal(r.state, "unknown");
      assert.isString(r.auth);
      assert.isString(r.prov);
    }
  }
});

suite.addBatch({
  "address_info for an unknown secondary address": {
     topic: wsapi.get('/wsapi/address_info', {
      email: SECONDARY_TEST_EMAIL
     }),
    "returns unknown": function(e, r) {
      assert.isNull(e);
      var r = JSON.parse(r.body);
      assert.equal(r.type, "secondary");
      assert.equal(r.issuer, "127.0.0.1");
      assert.equal(r.state, "unknown");
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
      var r = JSON.parse(r.body);
      assert.equal(r.type, "primary");
      assert.equal(r.state, "transition_to_primary");
      assert.isString(r.auth);
      assert.isString(r.prov);
    }
  }
});

//  test transition_to_secondary
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
        "returns transition_to_secondary": function(e, r) {
          assert.isNull(e);
          var r = JSON.parse(r.body);
          assert.equal(r.type, "secondary");
          assert.equal(r.state, "transition_to_secondary");
        },
        "removing the user's password": {
          topic: function() {
            var self = this;
            db.emailToUID('foo@example.com', function(err, uid) {
              if (err) return self.callback(err);
              db.updatePassword(uid, null, false, self.callback);
            });
          },
          "works": function(err) {
            assert(!err);
          },
          "and calling address info": {
            topic: wsapi.get('/wsapi/address_info', {
              email: "foo@example.com"
            }),
            "shows 'transition_no_password'": function(err, r) {
              assert.isNull(err);
              var r = JSON.parse(r.body);
              assert.equal(r.type, "secondary");
              assert.equal(r.state, "transition_no_password");
            }
          }
        }
      }
    }
  }
});


// test idp offline
suite.addBatch({
  "record that we've seen example.com": {
     topic: function() {
       db.updateIDPLastSeen('example.com', this.callback);
     },
    "works": function(e, r) {
      assert.isNull(e);
    },
    "and waiting a moment": {
      topic: function() {
        setTimeout(this.callback, 500);
      },
      "and checking address info": {
        topic: wsapi.get('/wsapi/address_info', {
          email: "foo@example.com"
        }),
        "returns offline": function(e, r) {
          assert.isNull(e);
          var r = JSON.parse(r.body);
          assert.equal(r.state, "offline");
          assert.equal(r.type, "secondary");
        }
      }
    }
  }
});

// test idp explicitly disabled
suite.addBatch({
  "creating a secondary user": {
     topic: function() {
       secondary.create({ email: "foo@disabled.domain" }, this.callback);
     },
    "works": function(e, r) {
      assert.isNull(e);
    },
    "and report domain as seen": {
      topic: function() {
        db.updateIDPLastSeen('disabled.domain', this.callback);
      },
      "works": function(e) {
        assert.isNull(e);
      },
      "and calling address info": {
        topic: wsapi.get('/wsapi/address_info', {
          email: "foo@disabled.domain"
        }),
        "returns 'known' and not 'offline'": function(e, r) {
          assert.isNull(e);
          var r = JSON.parse(r.body);
          assert.equal(r.type, "secondary");
          assert.equal(r.state, "known");
        },
        "causes IDPLastSeen": {
          topic: function() { setTimeout(this.callback, 500); },
          "after a moment": {
            topic: function() {
              db.getIDPLastSeen('disabled.domain', this.callback);
            },
            "to be purged": function(err, r) {
              assert.isNull(err);
              assert.strictEqual(r, null);
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
