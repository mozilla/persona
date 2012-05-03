#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs = require('fs'),
      // TODO: convert to vows based test (or introduce nodeunit dependency)
      vows = require('vows'),
      coarse = require('../lib/coarse_user_agent_parser'),
      assert = require('assert'),
      path = require('path');

var suite = vows.describe('coarse-user-agent-parser');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

/* Update test data with https://gist.github.com/2590547 */

suite.addBatch({
  "UA parsing": {
    topic: function() {
      fs.readFile(path.join(__dirname, 'data/user_agents.json'), 'utf-8', this.callback);
    },
    "data can be read": function(err, data) {
      assert.isNull(err);
    },
    "with lots of data": {
      topic: function(err, data) {
        this.callback(JSON.parse(data));
      },
      "demonstrates proper functioning of coarse parser": function(test_data) {
        for (var i=0; i < test_data.tests.length; i++) {
          var t = test_data.tests[i];
          if (t.ua) {
            var actual = coarse.parse(t.ua);
            assert.strictEqual(t.os, actual.os, t.ua);
            assert.strictEqual(t.browser, actual.browser, t.ua);
            assert.strictEqual(t.version, actual.version, t.ua);
          }
        }
      }
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
