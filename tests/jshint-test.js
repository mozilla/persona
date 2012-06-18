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
      var child = exec(jshintPath + ' --config ./data/lib.jshintrc ../lib/ | grep "not defined"', {cwd: path.resolve(__dirname)}, this.callback);
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
