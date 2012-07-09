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
db = require('../lib/db.js'),
config = require('../lib/configuration.js'),
bcrypt = require('bcrypt'),
http = require('http');

var suite = vows.describe('heartbeat');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

// test deep and shallow heartbeats work for all processes
[ 10004, 10002, 10003, 10004, 10007 ].forEach(function(port) {
  [ true, false ].forEach(function(shallow) {
    var testName = "shallow heartbeat check for 127.0.0.1:" + port;
    suite.addBatch({
      testName: {
        topic: function() {
          var self = this;

          var req = http.get({
            host: '127.0.0.1',
            port: port,
            path: '/__heartbeat__' + ( shallow ? "" : "?deep=true")
          }, function(res) {
            self.callback(null, res.statusCode);
            req.abort();
          }).on('error', function(e) {
            self.callback(e, null);
            req.abort();
          });
        },
        "works":     function(err, code) {
          assert.strictEqual(err, null);
          assert.equal(code, 200);
        }
      }
    });
  });
});

// now let's SIGSTOP the browserid process and verify that the router's
// deep heartbeat fails within 11s
suite.addBatch({
  "stopping the browserid process": {
    topic: function() {
      process.kill(parseInt(process.env['BROWSERID_PID'], 10), 'SIGSTOP');      
      this.callback();
    },
    "then doing a deep __heartbeat__ on router": {
      topic: function() {
        var self = this;
        var start = new Date();
        var req = http.get({
          host: '127.0.0.1',
          port: 10002,
          path: '/__heartbeat__?deep=true'
        }, function(res) {
          self.callback(null, res.statusCode, start);
          req.abort();
        }).on('error', function(e) {
          self.callback(e, null);
          req.abort();
        });
      },
      "fails": function(e, code, start) {
        assert.ok(!e);
        assert.strictEqual(500, code);
      },
      "takes about 5s": function(e, code, start) {
        assert.ok(!e);
        var elapsedMS = new Date() - start;
        assert.ok(3000 < elapsedMS < 7000);
      },
      "but upon SIGCONT": {
        topic: function(e, code) {
          process.kill(parseInt(process.env['BROWSERID_PID'], 10), 'SIGCONT');      
          this.callback();
        },
        "a deep heartbeat": {
          topic: function() {
            var self = this;
            var req = http.get(
              { host: '127.0.0.1', port: 10002, path: '/__heartbeat__?deep=true'},
              function(res) {
                self.callback(null, res.statusCode);
                req.abort();
              }).on('error', function(e) {
                self.callback(e, null);
                req.abort();
              });
          },
          "works": function(err, code) {
            assert.ok(!err);
            assert.strictEqual(200, code);
          }
        }
      }
    }
  }
});

// now let's SIGSTOP the static process and verify that the router's
// deep heartbeat fails within 11s
suite.addBatch({
  "stopping the static process": {
    topic: function() {
      process.kill(parseInt(process.env['STATIC_PID'], 10), 'SIGSTOP');      
      this.callback();
    },
    "then doing a deep __heartbeat__ on router": {
      topic: function() {
        var self = this;
        var start = new Date();
        var req = http.get({
          host: '127.0.0.1',
          port: 10002,
          path: '/__heartbeat__?deep=true'
        }, function(res) {
          self.callback(null, res.statusCode, start);
          req.abort();
        }).on('error', function(e) {
          self.callback(e, null);
          req.abort();
        });
      },
      "fails": function(e, code, start) {
        assert.ok(!e);
        assert.strictEqual(500, code);
      },
      "takes about 5s": function(e, code, start) {
        assert.ok(!e);
        var elapsedMS = new Date() - start;
        assert.ok(3000 < elapsedMS < 7000);
      },
      "but upon SIGCONT": {
        topic: function(e, code) {
          process.kill(parseInt(process.env['STATIC_PID'], 10), 'SIGCONT');      
          this.callback();
        },
        "a deep heartbeat": {
          topic: function() {
            var self = this;
            var req = http.get(
              { host: '127.0.0.1', port: 10002, path: '/__heartbeat__?deep=true'},
              function(res) {
                self.callback(null, res.statusCode);
                req.abort();
              }).on('error', function(e) {
                self.callback(e, null);
                req.abort();
              });
          },
          "works": function(err, code) {
            assert.ok(!err);
            assert.strictEqual(200, code);
          }
        }
      }
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
