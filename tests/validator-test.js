#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js');

var suite = vows.describe('validator');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

var token = undefined;
const email = 'von-rothbart@fxos.com',
      password = 'swanlake',
      origins = [
        'http://foo.gov',
        'https://amazingness.info',
        'app://{de033450-7498-4d8e-be4a-d4472cee4489}',
        'resource://i-like-pie'
      ];

origins.forEach(function(origin) {
  var scheme = origin.split("://")[0];
  // separate variables so we can apply in strict order
  var batch1 = {};
  var batch2 = {};
  var batch3 = {};

  batch1["account staging for " + scheme] = {
    topic: wsapi.post('/wsapi/stage_user', {
      email: email,
      pass: password,
      site: origin
    }),
    "works":     function(err, r) {
      assert.equal(r.code, 200);
    }
  };
  suite.addBatch(batch1);

  batch2["a token for " + scheme] = {
    topic: function() {
      start_stop.waitForToken(this.callback);
    },
    "is obtained": function (t) {
      assert.isString(t);
      token = t;
    }
  };
  suite.addBatch(batch2);

  batch3["setting password and creating the account for " + scheme] = {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', {
        token: token
      }).call(this);
    },
    "works just fine": function(err, r) {
      assert.equal(r.code, 200);
    }
  };
  suite.addBatch(batch3);
});
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
