#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const
assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
primary = require('./lib/primary.js');

var suite = vows.describe('verify-in-different-browser');

// start up a pristine server
start_stop.addStartupBatches(suite);

// This test ensures that when email verification of a secondary address
// occurs in a browsing context other than the one that initiated it,
// the user must re-provide their password.

// first we'll need to authenticate a user with an assertion from a
// primary IdP

const TEST_DOMAIN = 'example.domain',
      TEST_EMAIL = 'testuser@' + TEST_DOMAIN,
      TEST_ORIGIN = 'http://127.0.0.1:10002',
      TEST_PASS = 'fakepass',
      SECONDARY_EMAIL = 'secondary@notexample.domain',
      SECOND_SECONDARY_EMAIL = 'secondsecondary@notexample.domain',
      THIRD_SECONDARY_EMAIL = 'thirdsecondary@notexample.domain',
      FOURTH_SECONDARY_EMAIL = 'fourthsecondary@notexample.domain';

var primaryUser = new primary({
  email: TEST_EMAIL,
  domain: TEST_DOMAIN
});

suite.addBatch({
  "set things up": {
    topic: function() {
      primaryUser.setup(this.callback);
    },
    "works": function() {
      // nothing to do here
    }
  }
});

// first we'll create an account without a password by using
// a primary address.
suite.addBatch({
  "generating an assertion": {
    topic: function() {
      return primaryUser.getAssertion(TEST_ORIGIN, this.callback);
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
});

var token;

// let's add a secondary email to this account
suite.addBatch({
  "add a new email address to our account": {
    topic: wsapi.post('/wsapi/stage_email', {
      email: SECONDARY_EMAIL,
      pass: TEST_PASS,
      site:'https://fakesite.com'
    }),
    "succeeds": function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "and get a token": {
      topic: function() {
        start_stop.waitForToken(this.callback);
      },
      "successfully": function (t) {
        this._token = t;
        assert.strictEqual(typeof t, 'string');
      },
      "then clearing cookies and completing": {
        topic: function() {
          wsapi.clearCookies();
          wsapi.post('/wsapi/complete_email_confirmation', {
            token: this._token
          }).call(this);
        },
        "fails without a password": function(err, r) {
          assert.strictEqual(r.code, 401);
        },
        "but succeeds": {
          topic: function() {
            wsapi.post('/wsapi/complete_email_confirmation', {
              token: this._token,
              pass: TEST_PASS
            }).call(this);
          },
          "with one": function(err, r) {
            assert.strictEqual(r.code, 200);
          }
        }
      }
    }
  }
});

// after adding a secondary and setting password, we're password auth'd
suite.addBatch({
  "auth_level": {
    topic: wsapi.get('/wsapi/session_context'),
    "is 'password' after authenticating with password" : function(err, r) {
      assert.strictEqual(JSON.parse(r.body).auth_level, 'password');
    }
  }
});

// we can authenticate with our password
suite.addBatch({
  "authenticating with our newly set password" : {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: TEST_PASS,
      ephemeral: false
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  }
});

// let's add another secondary email, again by confirming the address on
// "a different browser".  This time, the server will have to authenticate
// us by pulling our password out of our user record rather than out of
// the stage table.
suite.addBatch({
  "add a new email address to our account": {
    topic: wsapi.post('/wsapi/stage_email', {
      email: SECOND_SECONDARY_EMAIL,
      site:'https://fakesite.com'
    }),
    "succeeds": function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "and get a token": {
      topic: function() {
        start_stop.waitForToken(this.callback);
      },
      "successfully": function (t) {
        this._token = t;
        assert.strictEqual(typeof t, 'string');
      },
      "then clearing cookies and completing": {
        topic: function() {
          wsapi.clearCookies();
          wsapi.post('/wsapi/complete_email_confirmation', {
            token: this._token
          }).call(this);
        },
        "fails without a password": function(err, r) {
          assert.strictEqual(r.code, 401);
        },
        "but succeeds": {
          topic: function() {
            wsapi.post('/wsapi/complete_email_confirmation', {
              token: this._token,
              pass: TEST_PASS
            }).call(this);
          },
          "with one": function(err, r) {
            assert.strictEqual(r.code, 200);
          }
        }
      }
    }
  }
});

// we're password auth'd
suite.addBatch({
  "auth_level": {
    topic: wsapi.get('/wsapi/session_context'),
    "is 'password' after authenticating with password" : function(err, r) {
      assert.strictEqual(JSON.parse(r.body).auth_level, 'password');
    }
  }
});


// we can still authenticate with our password
suite.addBatch({
  "authenticating with our newly set password" : {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: TEST_PASS,
      ephemeral: false
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  }
});

// now we've tested proper restrictions on the add email, flow, how about
// new account creation?

// creating a new account and verifying in "a different browser" requires password
suite.addBatch({
  "staging a new account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: THIRD_SECONDARY_EMAIL,
      pass:  TEST_PASS,
      site:  'http://fakesite.com:1235'
    }),
    "succeeds": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).success, true);
    },
    "yields a token": {
      topic: function() {
        start_stop.waitForToken(this.callback);
      },
      "successfully": function (t) {
        this._token = t;
        assert.strictEqual(typeof t, 'string');
      },
      "then clearing cookies and completing": {
        topic: function() {
          wsapi.clearCookies();
          wsapi.post('/wsapi/complete_user_creation', {
            token: this._token
          }).call(this);
        },
        "fails without a password": function(err, r) {
          assert.strictEqual(r.code, 401);
        },
        "but succeeds": {
          topic: function() {
            wsapi.post('/wsapi/complete_user_creation', {
              token: this._token,
              pass: TEST_PASS
            }).call(this);
          },
          "with one": function(err, r) {
            assert.strictEqual(r.code, 200);
          }
        }
      }
    }
  }
});

// creating a new account and verifying in "the same browser" requires no password
suite.addBatch({
  "staging a new account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: FOURTH_SECONDARY_EMAIL,
      pass:  TEST_PASS,
      site:  'http://fakesite.com:1235'
    }),
    "succeeds": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).success, true);
    },
    "yields a token": {
      topic: function() {
        start_stop.waitForToken(this.callback);
      },
      "successfully": function (t) {
        this._token = t;
        assert.strictEqual(typeof t, 'string');
      },
      "and completion with only a token": {
        topic: function() {
          wsapi.post('/wsapi/complete_user_creation', {
            token: this._token
          }).call(this);
        },
        "succeeds": function(err, r) {
          assert.strictEqual(r.code, 200);
        }
      }
    }
  }
});

suite.addBatch({
  "authentication with first email": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: TEST_PASS,
      ephemeral: false
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
    },
  },
  "authentication with second email": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: SECONDARY_EMAIL,
      pass: TEST_PASS,
      ephemeral: false
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  },
  "authentication with third email": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: SECOND_SECONDARY_EMAIL,
      pass: TEST_PASS,
      ephemeral: false
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  },
  "authentication with fourth email": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: THIRD_SECONDARY_EMAIL,
      pass: TEST_PASS,
      ephemeral: false
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  },
  "authentication with fifth email": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: FOURTH_SECONDARY_EMAIL,
      pass: TEST_PASS,
      ephemeral: false
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  }
});


// shut the server down and cleanup
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
