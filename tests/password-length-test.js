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
email = require('../lib/email.js');

var suite = vows.describe('password-length');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

// surpress console output of emails with a noop email intercepto
var token = undefined;
start_stop.browserid.on('token', function(secret) {
  token = secret;
});

suite.addBatch({
  "get csrf token": {
    topic: wsapi.get('/wsapi/session_context'),
    "works": function (err, r) {
      assert.equal(typeof r.body, 'string');
      var v = JSON.parse(r.body);
      assert.equal(typeof v, 'object');
      assert.equal(typeof v.csrf_token, 'string');
      assert.equal(typeof v.server_time, 'number');
    }
  }
});

// first stage the account
suite.addBatch({
  "account staging": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      site:'https://fakesite.com:123'
    }),
    "works":     function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});

// create a new account via the api with (first address)
suite.addBatch({
  "a password that is too short": {
    topic: wsapi.post('/wsapi/complete_user_creation', {
      token: token,
      pass: '0123456' // less than 8 chars, invalid
    }),
    "causes a HTTP error response": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(r.body, "Bad Request: valid passwords are between 8 and 80 chars");
    }
  },
  "a password that is too long": {
    topic: wsapi.post('/wsapi/complete_user_creation', {
      token: token,
      pass: '012345678901234567890123456789012345678901234567890123456789012345678901234567891', // more than 81 chars, invalid.
    }),
    "causes a HTTP error response": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(r.body, "Bad Request: valid passwords are between 8 and 80 chars");
    }
  },
  "but a password that is just right": {
    topic: wsapi.post('/wsapi/complete_user_creation', {
      token: token,
      pass: 'ahhh.  this is just right.'
    }),
    "works just fine": function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
