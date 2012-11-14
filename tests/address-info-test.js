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
bcrypt = require('bcrypt');

var suite = vows.describe('password-length');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

suite.addBatch({
  "address_info for an unknown address": {
     topic: wsapi.get('/wsapi/address_info', {
      email: 'test@example.domain'
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

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
