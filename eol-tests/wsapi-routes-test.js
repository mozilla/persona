#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


require('../tests/lib/test_env.js');

const assert = require('assert');
const http = require('http');
const vows = require('vows');
const start_stop = require('../tests/lib/start-stop.js');
const wsapi = require('../lib/wsapi.js');

const WSAPI_PREFIX = '/wsapi/';
const allAPIs = wsapi.allAPIs();

var suite = vows.describe('wsapi routes');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const batch = {};

Object.keys(allAPIs).forEach(function (apiName) {
  const API = allAPIs[apiName];
  addRouteTest(API.method, apiName, 410);
});

addRouteTest('get', 'non-existent', 404);
addRouteTest('post', 'non-existent', 404);

suite.addBatch(batch);

function addRouteTest (method, pathname, expectedStatus) {
  batch[method + ': ' + pathname] = {
    topic: function () {
      makeRequest(method, pathname, this.callback);
    },

    'returns the expected status': function (res) {
      assert.equal(res.statusCode, expectedStatus);
    }
  };
}

function makeRequest(method, pathname, done) {
  var req = http.request({
    host: '127.0.0.1',
    port: '10002',
    path: WSAPI_PREFIX + pathname,
    agent: false,
    method: method.toUpperCase()
  }, function (res) {
    res.on('end', done(res));
  });

  req.end();
}

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
