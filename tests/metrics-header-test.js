#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
fs = require('fs'),
path = require('path'),
http = require('http'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
urlparse = require('urlparse');

var suite = vows.describe('metrics header test');
suite.options.error = false;

// allow this unit test to be targeted
var SERVER_URL = process.env['SERVER_URL'] || 'http://127.0.0.1:10002/';

process.env.METRICS_LOG_FILE = path.resolve(path.join(__dirname, 'data', 'metrics.json'));

if (!process.env['SERVER_URL']) {
  // start up a pristine server if we're locally testing
  start_stop.addStartupBatches(suite);
}

// existsSync moved from path in 0.6.x to fs in 0.8.x
if (typeof fs.existsSync === 'function') {
  var existsSync = fs.existsSync;
} else {
  var existsSync = path.existsSync;
}

// now parse out host, port and scheme
var purl = urlparse(SERVER_URL);
const method = (purl.scheme === 'https') ? require('https') : require('http');

function doRequest(path, headers, cb) {
  var req = method.request({
    port: purl.port,
    host: purl.host,
    path: path,
    headers: headers,
    agent: false
  }, function(res) {
    req.abort();
    cb(null, res);
  });
  req.on('error', function(e) {
    cb(e);
  });
  req.end();
}

suite.addBatch({
  '/sign_in': {
    topic: function() {
      doRequest('/sign_in', {'user-agent': 'Test Runner', 'x-real-ip': '123.0.0.1', 'referer': 'https://persona.org'}, this.callback);
    },
    "metrics log exists": {
      topic: function (err, r) {
        if (existsSync(process.env.METRICS_LOG_FILE)) {
          this.callback();
        } else {
          fs.watchFile(process.env.METRICS_LOG_FILE, null, this.callback);
        }
      },
      "metric fields are logged properly": function (event, filename) {
        var metrics = JSON.parse(fs.readFileSync(process.env.METRICS_LOG_FILE, "utf8").trim());
        var message = JSON.parse(metrics.message);
        assert.equal(message.ip, "123.0.0.1");
        assert.equal(message.rp, "https://persona.org");
        assert.equal(message.browser, "Test Runner");
        fs.unwatchFile(process.env.METRICS_LOG_FILE);
      }
    }
  }
});


suite.addBatch({
  'clean up': function () {
    fs.unlink(process.env.METRICS_LOG_FILE);
    delete process.env.METRICS_LOG_FILE;
  }
});

// shut the server down and cleanup
if (!process.env['SERVER_URL']) {
  start_stop.addShutdownBatches(suite);
}


// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
