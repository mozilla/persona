#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop'),
wsapi = require('./lib/wsapi'),
config = require('../lib/configuration'),
metrics = require('../lib/logging/metrics');

require('./lib/test_env');

var suite = vows.describe('interaction-data');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

suite.addBatch({
  "POST /wsapi/interaction_data": {
    topic: wsapi.post('/wsapi/interaction_data', {}),
    "succeeds": function(err, r) {
      assert.isNull(err);
      assert.strictEqual(r.code, 200);
    }
  }
});

suite.addBatch({
  "reporting metrics": {
    topic: function() {
      try {
        metrics.report("type", "important metrics");
      }
      catch(e) {
        return e;
      }
      return null;
    },
    "doesn't fail": function(err) {
      assert.isNull(err);
    },
    "reports metrics to kpiggybank": function() {
      // HOW do we test this?
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);

