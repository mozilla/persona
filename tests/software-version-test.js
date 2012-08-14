#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const
assert = require('assert'),
vows = require('vows'),
fs = require('fs'),
path = require('path'),
version = require('../lib/version.js');

var suite = vows.describe('software-version');
suite.options.error = false;


suite.addBatch({
  "version": {
    topic: function() { version(this.callback); },
    "works": function(r) {
      assert.isString(r);
      assert.equal(r.length, 7);
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
