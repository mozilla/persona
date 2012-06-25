#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

// add lib/ to the require path

const
assert = require('assert'),
vows = require('vows'),
fs = require('fs'),
path = require('path'),
exec = require('child_process').exec;

var suite = vows.describe('jshint');
var jshintPath = '../node_modules/jshint/bin/hint';

// disable vows (often flakey?) async error behavior
suite.options.error = false;

suite.addBatch({
  "run jshint on the lib directory": {
    topic: function () {
      var cmd = jshintPath + ' --config ./data/lib.jshintrc ../lib/ | grep "not defined"';
      var child = exec(cmd, {cwd: path.resolve(__dirname)}, this.callback);
    },
    "jshint is found and runs" : function (error, stdout, stderr) {
      // NOTE: until we clean up jshint errors and agree on what options,
      // we only verify that the program was found and runs, but not that
      // it is completely clean and error free in jshint's opinion.
      assert.ok(!error || error.toString().indexOf('No such') === -1);
    },
    "no globals are created or referenced" : function (error, stdout, stderr) {
      var errors = stdout.split("\n").length - 1;
      assert.strictEqual(errors, 0);
    }
  }
});


// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
