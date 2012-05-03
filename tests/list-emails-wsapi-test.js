#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js');

var suite = vows.describe('forgotten-email');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

// ever time a new token is sent out, let's update the global
// var 'token'
var token = undefined;

// create a new account via the api with (first address)
suite.addBatch({
  "stage an account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'syncer@somehost.com',
      pass: 'fakepass',
      site:'https://foobar.fakesite.com'
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
  "verifying account ownership": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', { token: token }).call(this);
    },
    "works": function(err, r) {
      assert.equal(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).success, true);
      token = undefined;
    }
  }
});

suite.addBatch({
  "calling user_creation_status after a creation is complete": {
    topic: wsapi.get("/wsapi/user_creation_status", { email: 'syncer@somehost.com' }),
    "yields a HTTP 200": function (err, r) {
      assert.strictEqual(r.code, 200);
    },
    "returns a json encoded string - `complete`": function (err, r) {
      assert.strictEqual(JSON.parse(r.body).status, "complete");
    }
  }
});

suite.addBatch({
  "list emails API": {
    topic: wsapi.get('/wsapi/list_emails', {}),
    "succeeds with HTTP 200" : function(err, r) {
      assert.strictEqual(r.code, 200);
    },
    "returns an object with proper email": function(err, r) {
      var respObj = JSON.parse(r.body);
      var emails = Object.keys(respObj);
      assert.equal(emails[0], "syncer@somehost.com");
      assert.equal(respObj[emails[0]].type, "secondary");
      assert.equal(emails.length, 1);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
