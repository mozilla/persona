#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


require('../tests/lib/test_env.js');

const assert = require('assert');
const vows = require('vows');
const start_stop = require('../tests/lib/start-stop.js');
const wsapi = require('../lib/wsapi.js');

var suite = vows.describe('wsapi');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

suite.addBatch({
  'allAPIs': {
    topic: function() {
      return wsapi.allAPIs();
    },

    'works': function(allAPIs) {
      assert.equal(typeof allAPIs, 'object');
      assert.equal(Object.keys(allAPIs).length, 38);
    }
  }
});

var appMock;
suite.addBatch({
  'routeSetup': {
    topic: function() {
      appMock = {
        getCount: 0,
        postCount: 0,
        routeCount: 0,

        get: function (route, callback) {
          this.getCount++;
          this.routeCount++;
        },

        post: function () {
          this.postCount++;
          this.routeCount++;
        }
      };

      wsapi.routeSetup(appMock);
      return true;
    },

    'sets up the appropriate number of routes': function () {
      assert.equal(appMock.getCount, 16);
      assert.equal(appMock.postCount, 22);
      assert.equal(appMock.routeCount, 38);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
