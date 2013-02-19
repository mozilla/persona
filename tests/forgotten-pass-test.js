#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
email = require('../lib/email.js'),
jwcrypto = require('jwcrypto'),
secondary = require('./lib/secondary.js');

var suite = vows.describe('forgotten-email');

// algs
require("jwcrypto/lib/algs/ds");
require("jwcrypto/lib/algs/rs");

start_stop.addStartupBatches(suite);

// every time a new token is sent out, let's update the global
// var 'token'
var token = undefined;

// stores wsapi client context
var oldContext;

// create a new secondary account
suite.addBatch({
  "creating a secondary account": {
    topic: function() {
      secondary.create({
        email: 'first@fakeemail.com',
        pass: 'firstfakepass',
        site:'http://localhost:123'
      }, this.callback);
    },
    "succeeds": function(err, r) {
      assert.isNull(err);
    }
  }
});

suite.addBatch({
  "email created": {
    topic: wsapi.get('/wsapi/user_creation_status', { email: 'first@fakeemail.com' } ),
    "should exist": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).status, "complete");
    }
  }
});

// add a new email address to the account (second address)
suite.addBatch({
  "add a new email address to our account": {
    topic: wsapi.post('/wsapi/stage_email', {
      email: 'second@fakeemail.com',
      site:'https://fakesite.foobar.bizbaz.uk'
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

// should not require auth to complete
suite.addBatch({
  "given a token, getting an email": {
    topic: function() {
      wsapi.get('/wsapi/email_for_token', { token: token }).call(this);
    },
    "account created": function(err, r) {
      assert.equal(r.code, 200);
      var body = JSON.parse(r.body);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.must_auth, false);
    }
  }
});


// New context for a second client
suite.addBatch({
  "change context": function () {
    oldContext = wsapi.getContext();
    wsapi.setContext({});
  }
});

// should require auth to complete for second client
suite.addBatch({
  "given a token, getting an email": {
    topic: function() {
      wsapi.get('/wsapi/email_for_token', { token: token }).call(this);
    },
    "account created": function(err, r) {
      assert.equal(r.code, 200);
      var body = JSON.parse(r.body);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.must_auth, true);
    }
  }
});

// restore context of first client
suite.addBatch({
  "restore context": function () {
    wsapi.setContext(oldContext);
  }
});

// confirm second email email address to the account
suite.addBatch({
  "create second account": {
    topic: function() {
      wsapi.post('/wsapi/complete_email_confirmation', { token: token }).call(this);
    },
    "account created": function(err, r) {
      assert.equal(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).success, true);
      token = undefined;
    }
  }
});

// verify now both email addresses are known
suite.addBatch({
  "first email exists": {
    topic: wsapi.get('/wsapi/have_email', { email: 'first@fakeemail.com' }),
    "should exist": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).email_known, true);
    }
  },
  "second email exists": {
    topic: wsapi.get('/wsapi/have_email', { email: 'second@fakeemail.com' }),
    "should exist": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).email_known, true);
    }
  },
  "a random email doesn't exist": {
    topic: wsapi.get('/wsapi/have_email', { email: 'third@fakeemail.com' }),
    "shouldn't exist": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).email_known, false);
    }
  }
});

suite.addBatch({
  "reset status": {
    topic: wsapi.get('/wsapi/password_reset_status', { email: 'first@fakeemail.com' } ),
    "returns 'complete' before calling reset": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).status, "complete");
    }
  }
});

// Run the "forgot_email" flow with first address. 
suite.addBatch({
  "reset password on first account": {
    topic: wsapi.post('/wsapi/stage_reset', {
      email: 'first@fakeemail.com',
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
    "account created": function(err, r) {
      assert.equal(r.code, 200);
      var body = JSON.parse(r.body);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.needs_password, true);
    }
  }
});

// verify that the old email address + password combinations are still
// valid (this is so *until* someone clicks through)
suite.addBatch({
  "first email works": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: 'first@fakeemail.com',
      pass: 'firstfakepass',
      ephemeral: false
    }),
    "should work": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  },
  "second email works": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: 'second@fakeemail.com',
      pass: 'firstfakepass',
      ephemeral: false
    }),
    "should work": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  },
  "reset status": {
    topic: wsapi.get('/wsapi/password_reset_status', { email: 'first@fakeemail.com' } ),
    "returns 'pending' after calling reset": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).status, "pending");
    }
  }
});

// now let's complete the re-registration of first email address
suite.addBatch({
  "complete password reset": {
    topic: function() {
      wsapi.post('/wsapi/complete_reset', {
        pass: 'secondfakepass',
        token: token
      }).call(this);
    },
    "account created": function(err, r) {
      assert.equal(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

suite.addBatch({
  "reset status": {
    topic: wsapi.get('/wsapi/password_reset_status', { email: 'first@fakeemail.com' } ),
    "returns 'complete' after completing reset": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).status, "complete");
    }
  }
});

// now we should be able to sign in using any email address
suite.addBatch({
  "first email, first pass bad": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: 'first@fakeemail.com',
      pass: 'firstfakepass',
      ephemeral: false
    }),
    "shouldn't work": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  },
  "first email, second pass good": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: 'first@fakeemail.com',
      pass: 'secondfakepass',
      ephemeral: false
    }),
    "should work": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  },
  "second email, first pass bad": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: 'second@fakeemail.com',
      pass: 'firstfakepass',
      ephemeral: false
    }),
    "should work": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  },
  "second email, second pass bad": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: 'second@fakeemail.com',
      pass: 'secondfakepass',
      ephemeral: false
    }),
    "shouldn' work": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  },
});

// Test issue #2104: when using a second browser to initiate password reset, first
// browser should be prompted to authenticate

// New context for a second client
suite.addBatch({
  "change context": function () {
    oldContext = wsapi.getContext();
    wsapi.setContext({});
  }
});

// Run the "forgot_email" flow with first address. 
suite.addBatch({
  "reset password on first account": {
    topic: wsapi.post('/wsapi/stage_reset', {
      email: 'first@fakeemail.com',
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

// restore context of first client
suite.addBatch({
  "restore context": function () {
    wsapi.setContext(oldContext);
  }
});

suite.addBatch({
  "given a token, getting an email": {
    topic: function() {
      wsapi.get('/wsapi/email_for_token', { token: token }).call(this);
    },
    "account created": function(err, r) {
      assert.equal(r.code, 200);
      var body = JSON.parse(r.body);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.email, 'first@fakeemail.com');
      assert.strictEqual(body.needs_password, true);
    }
  }
});


// test verification status of emails
suite.addBatch({
  "address_info for first": {
    topic: wsapi.get('/wsapi/address_info', {
      email: 'first@fakeemail.com'
    }),
    "succeeds with HTTP 200" : function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "reports the email is known (which implies it's also verified)": function(err, r) {
      r = JSON.parse(r.body);
      assert.strictEqual(r.state, 'known');
    }
  },
  "address_info for second": {
    topic: wsapi.get('/wsapi/address_info', {
      email: 'second@fakeemail.com'
    }),
    "succeeds with HTTP 200" : function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "reports unverified": function(err, r) {
      r = JSON.parse(r.body);
      assert.strictEqual(r.state, 'unverified');
    }
  }
});

// test that certification fails for unverified email addresses

// generate a keypair, we'll use this to sign assertions, as if
// this keypair is stored in the browser localStorage
var kp;

suite.addBatch({
  "generate a keypair": {
    topic: function() {
      jwcrypto.generateKeypair({algorithm: "RS", keysize: 64}, this.callback);
    },
    "works": function(err, keypair) {
      assert.isNull(err);
      assert.isObject(keypair);
      kp = keypair;
    },
    "and cert a key for a verified email address": {
      topic: function() {
        wsapi.post('/wsapi/cert_key', {
          email: 'first@fakeemail.com',
          pubkey: kp.publicKey.serialize(),
          ephemeral: false
        }).call(this);
      },
      "returns a success response" : function(err, r) {
        assert.strictEqual(r.code, 200);
      }
    },
    "and cert a key for an unverified email address": {
      topic: function() {
        wsapi.post('/wsapi/cert_key', {
          email: 'second@fakeemail.com',
          pubkey: kp.publicKey.serialize(),
          ephemeral: false
        }).call(this);
      },
      "is forbidden" : function(err, r) {
        assert.strictEqual(r.code, 403);
      }
    }
  }
});

// Now we have an account with an unverified email.  Let's attempt to reverify our other email
// address
// Run the "forgot_email" flow with first address. 
suite.addBatch({
  "reverify a non-existent email": {
    topic: wsapi.post('/wsapi/stage_reverify', {
      email: 'dne@fakeemail.com',
      site:'https://otherfakesite.com'
    }),
    "fails": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  },
  "reverify a verified email": {
    topic: wsapi.post('/wsapi/stage_reverify', {
      email: 'first@fakeemail.com',
      site:'https://otherfakesite.com'
    }),
    "fails": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  },
  "reverify an unverified email": {
    topic: wsapi.post('/wsapi/stage_reverify', {
      email: 'second@fakeemail.com',
      site:'https://otherfakesite.com'
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

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
    "works dandy": function(err, r) {
      assert.equal(r.code, 200);
      var body = JSON.parse(r.body);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.email, 'second@fakeemail.com');
    }
  }
});

suite.addBatch({
  "reverify status": {
    topic: function() {
      wsapi.get('/wsapi/email_reverify_status', { email: "second@fakeemail.com" }).call(this);
    },
    "is pending": function(err, r) {
      assert.equal(r.code, 200);
      var body = JSON.parse(r.body);
      assert.strictEqual(body.status, 'pending');
    }
  }
});

suite.addBatch({
  "complete reverify": {
    topic: function() {
      wsapi.post('/wsapi/complete_email_confirmation', { token: token }).call(this);
    },
    "works": function(err, r) {
      assert.equal(r.code, 200);
      var body = JSON.parse(r.body);
    }
  }
});

suite.addBatch({
  "after reverification": {
    topic: function() {
      jwcrypto.generateKeypair({algorithm: "RS", keysize: 64}, this.callback);
    },
    "we can generate a keypair": function(err, keypair) {
      assert.isNull(err);
      assert.isObject(keypair);
      kp = keypair;
    },
    "we can certify a key for the email address": {
      topic: function() {
        wsapi.post('/wsapi/cert_key', {
          email: 'second@fakeemail.com',
          pubkey: kp.publicKey.serialize(),
          ephemeral: false
        }).call(this);
      },
      "returns a success response" : function(err, r) {
        assert.strictEqual(r.code, 200);
      }
    }
  }
});


start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
