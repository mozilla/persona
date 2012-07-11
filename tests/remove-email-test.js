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
jwcrypto = require('jwcrypto');

var suite = vows.describe('forgotten-email');

// algs
require("jwcrypto/lib/algs/ds");
require("jwcrypto/lib/algs/rs");

start_stop.addStartupBatches(suite);

// every time a new token is sent out, let's update the global
// var 'token'
var token = undefined;

// create a new account via the api with (first address)
suite.addBatch({
  "staging an account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      pass: 'firstfakepass',
      site:'http://localhost:123'
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
    "is obtained": function (t) {
      assert.strictEqual(typeof t, 'string');
      token = t;
    }
  }
});

suite.addBatch({
  "create first account": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', { token: token }).call(this);
    },
    "account created": function(err, r) {
      assert.equal(r.code, 200);
      assert.strictEqual(true, JSON.parse(r.body).success);
      token = undefined;
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
    "is obtained": function (t) {
      assert.strictEqual(typeof t, 'string');
      token = t;
    }
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
  "list emails API": {
    topic: wsapi.get('/wsapi/list_emails', {}),
    "succeeds with HTTP 200" : function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "returns two emails": function(err, r) {
      r = Object.keys(JSON.parse(r.body));
      assert.ok(r.indexOf('first@fakeemail.com') != -1);
      assert.ok(r.indexOf('second@fakeemail.com') != -1);
    }
  }
});

suite.addBatch({
  "remove email": {
    topic: wsapi.post('/wsapi/remove_email', { email: 'second@fakeemail.com'}),
    "succeeds with HTTP 200" : function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  }
});

suite.addBatch({
  "list emails API": {
    topic: wsapi.get('/wsapi/list_emails', {}),
    "succeeds with HTTP 200" : function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "returns one emails": function(err, r) {
      r = Object.keys(JSON.parse(r.body));
      assert.ok(r.indexOf('first@fakeemail.com') !== -1);
      assert.ok(r.indexOf('second@fakeemail.com') === -1);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
