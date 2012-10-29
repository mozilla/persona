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
var jshint = require('../node_modules/jshint/lib/hint').hint;

// disable vows (often flakey?) async error behavior
suite.options.error = false;

function jshintFormatter(errors) {
  return errors.map(function(e) {
    return e.error.reason + ' ' + e.file + ':' + e.error.line;
  });
}

suite.addBatch({
  "run jshint on the lib directory": {
    topic: function () {
      var libPath = [path.join(__dirname, '../lib')];
      var libRc = JSON.parse(fs.readFileSync(path.join(__dirname, '../.jshintrc')).toString());
      return jshintFormatter(jshint(libPath, libRc, function noop_reporter(){}));
    },
    "should have no jshint warnings" : function (errors) {
      assert.lengthOf(errors, 0);
    }
  },
  "run jshint on the static directory": {
    topic: function() {
      // we want most of the static js files, except for test, build,
      // production, and perhaps some of the lib files (jQuery?)
      var paths = [ path.join(__dirname, '../resources/static') ];
      var ignores = [
        path.join(__dirname, '../resources/static/test'),
        path.join(__dirname, '../resources/static/build'),
        path.join(__dirname, '../resources/static/production'),

        // 3rd party libs that we shouldnt hint
        path.join(__dirname, '../resources/static/common/js/lib'),

        //XXX: these include WinChan, which we're not hinting yet
        path.join(__dirname, '../resources/static/include_js'),
        path.join(__dirname, '../resources/static/provisioning_api.js')
      ];
      var staticRc = JSON.parse(fs.readFileSync(path.join(__dirname, '../resources/static/.jshintrc').toString()));
      return jshintFormatter(jshint(paths, staticRc, function noop_reporter(){}, ignores));
    },
    "should have no jshint warnings": function(errors) {
      assert.lengthOf(errors, 0);
    }
  }
});


// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
