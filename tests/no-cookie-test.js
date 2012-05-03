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
http = require('http');

var suite = vows.describe('registration-status-wsapi');

// ever time a new token is sent out, let's update the global
// var 'token'
var token = undefined;

// start up a pristine server
start_stop.addStartupBatches(suite);

// now start a registration
suite.addBatch({
  "start registration": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      pass: 'firstfakepass',
      site:'http://fakesite.com:123'
    }),
    "returns 200": function(err, r) {
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
  "completing user creation": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', { token: token }).call(this);
    },
    "works": function(err, r) {
      assert.equal(r.code, 200);
      token = undefined;
    }
  }
});

suite.addBatch({
  "attempt to auth without cookie": {
    topic: function() {
      var cb = this.callback;

      var req = http.request({
        host: '127.0.0.1',
        port: 10002,
        path: '/wsapi/authenticate_user',
        headers: { 'Content-Type': 'application/json' },
        method: "POST",
        agent: false // disable node.js connection pooling
      }, function(res) {
        var body = '';
        res.on('data', function(chunk) { body += chunk; })
          .on('end', function() {
            cb(null, {code: res.statusCode, headers: res.headers, body: body});
          });
      }).on('error', function (e) {
        cb(e);
      });
      req.write(JSON.stringify({
        csrf: wsapi.getCSRF(),
        email: 'first@fakeemail.com',
        pass: 'firstfakepass'
      }));
      req.end();
    },
    "returns a 403 with 'no cookie' as the body": function(err, r) {
      assert.equal(err, null);
      assert.equal(r.code, 403);
      assert.equal(r.body, 'Forbidden: no cookie');
    }
  }
});

// shut the server down and cleanup
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
