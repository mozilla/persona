#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('../tests/lib/test_env.js');

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('../tests/lib/start-stop.js'),
spawn = require('child_process').spawn,
path = require('path');

var suite = vows.describe('frontend-tests');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

suite.addBatch({
  "PhantomJS binary": {
    topic: function() {
      var kid = spawn('phantomjs', [ '--version' ]);
      kid.on('exit', this.callback);
    },
    "is in path and executable": function(code) {
      assert.strictEqual(code, 0);
    }
  }
});

start_stop.addStartupBatches(suite);

suite.addBatch({
  "frontend unit tests": {
    topic: function() {
      var filter = process.env['FRONTEND_TEST_FILTER'] ?
                   '?filter=' + process.env['FRONTEND_TEST_FILTER'] : '';
      var kid = spawn('phantomjs', [ path.join(__dirname, 'phantomrunner.js'),
                                     'http://127.0.0.1:10002/test/'+filter ]);
      kid.stdout.on('data', function(d) { process.stdout.write(d); });
      kid.stderr.on('data', function(d) { process.stderr.write(d); });
      kid.on('exit', this.callback);
    },
    "pass!": function(code) {
      assert.strictEqual(code, 0);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run({}, function(r) { process.exit(r.honored == r.total ? 0 : 1); });
else suite.export(module);

