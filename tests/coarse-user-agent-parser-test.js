#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs = require('fs'),
      // TODO: convert to vows based test (or introduce nodeunit dependency)
      vows = require('vows'),
      coarse = require('../lib/coarse_user_agent_parser'),
      path = require('path');

var suite = vows.describe('coarse-user-agent-parser');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

/* Update test data with https://gist.github.com/2590547 */

fs.readFile(path.join(__dirname, 'data/user_agents.json'), 'utf-8', function (err, data) {
  if (err) {
    console.error(err);
  } else {
    var test_data = JSON.parse(data);
    for (var i=0; i < test_data.tests.length; i++) {
      var t = test_data.tests[i];
      if (t.ua) {
        var actual = coarse.parse(t.ua);
        if (actual.os != t.os) {
          console.error('Error parsing ' + t.ua + ' expected [' + t.os + '] got [' + actual.os + ']');
        }
        if (actual.browser != t.browser) {
          console.error('Error parsing ' + t.ua + ' expected [' + t.browser + '] got [' + actual.browser + ']');
        }
        if (actual.version != t.version) {
          console.error('Error parsing ' + t.ua + ' expected [' + t.version + '] got [' + actual.version + ']');
        }
      }
    }
    console.log('Finished ' + test_data.tests.length);
  }
});