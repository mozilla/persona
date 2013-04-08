#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
config = require('../lib/configuration.js'),
http = require('http'),
secrets = require('../lib/secrets.js'),
version = require('../lib/version.js');

var suite = vows.describe('post-limiting');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

var code_version;

function getVersion(done) {
  version(function(commit) {
    code_version = commit;
    done();
  });
}

function request(opts, done) {
  var headers = opts.headers = opts.headers || {};
  if (opts.path.indexOf('/wsapi') > -1) {
    headers['BrowserID-git-sha'] = code_version;
  }
  return http.request(opts, done);
}

function addTests(port, path) {
  // test posting more than 10kb
  suite.addBatch({
    "posting more than 10kb": {
      topic: function()  {
        var cb = this.callback;
        getVersion(function() {
          var req = request({
            host: '127.0.0.1',
            port: port,
            path: path,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            method: "POST"
          }, function (res) {
            cb(null, res);
          }).on('error', function (e) {
            cb(e);
          });
          req.write(secrets.weakGenerate(1024 * 10 + 1));
          req.end();
        });
      },
      "fails": function (err) {
        assert.ok(/socket hang up/.test(err.toString()));
      }
    }
  });

  // test posting more than 10kb with content-length header
  suite.addBatch({
    "posting more than 10kb with content-length": {
      topic: function()  {
        var cb = this.callback;
        getVersion(function() {
          var req = request({
            host: '127.0.0.1',
            port: port,
            path: path,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': 1024 * 10 + 1
            },
            method: "POST"
          }, function (res) {
            cb(null, res);
          }).on('error', function (e) {
            cb(e);
          });
          req.write(secrets.weakGenerate(1024 * 10 + 1));
          req.end();
        });
      },
      "fails": function (err, r) {
        assert.strictEqual(413, r.statusCode);
      }
    }
  });
}

// test the browserid process.
addTests(10002, '/wsapi/authenticate_user');
// test the verifier
addTests(10000, '/verify');

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
