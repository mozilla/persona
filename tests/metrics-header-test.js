#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const vows = require('vows');
const urlparse = require('urlparse');
const logger = require('../lib/logging/logging').logger;
const start_stop = require('./lib/start-stop');
const wsapi = require('./lib/wsapi');
const config = require('../lib/configuration');
const metrics_middleware = require('../lib/logging/middleware/metrics');
const KpiTransport = require('../lib/logging/transports/metrics-kpi');

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

// check end to end for /sign_in

suite.addBatch({
  '/sign_in': {
    topic: function() {
      doRequest('/sign_in', {'user-agent': 'Test Runner', 'x-real-ip': '123.0.0.1', 'referer': 'https://persona.org'}, this.callback);
    },
    "metrics log exists": {
      topic: function() {
        if (existsSync(process.env.METRICS_LOG_FILE)) {
          this.callback();
        } else {
          fs.watchFile(process.env.METRICS_LOG_FILE, null, this.callback);
        }
      },
      "metric fields are logged properly": function () {
        var metrics = JSON.parse(fs.readFileSync(process.env.METRICS_LOG_FILE, "utf8").trim());
        var message = JSON.parse(metrics.message);
        assert.equal(message.type, "signin");
        assert.equal(message.ip, "123.0.0.1");
        assert.equal(message.rp, "https://persona.org");
        assert.equal(message.browser, "Test Runner");
        fs.unwatchFile(process.env.METRICS_LOG_FILE);
      }
    }
  }
});


// Listen for actual messages that are sent to the KPI transport.
// reset the transport queue between each test run to ensure we only get the
// messages we care about.
var kpiTransport = KpiTransport.getInstance();

function noOp() {}

function sendRequestToMetricsMiddleware(url, referer) {
  kpiTransport.reset();

  metrics_middleware({
    connection: {
      remoteAddress: '127.0.0.2'
    },
    url: url,
    headers: {
      'user-agent': 'Firefox',
      'x-real-ip': '127.0.0.1',
      'referer': referer || 'https://sendmypin.org/auth'
    }
  }, noOp, noOp);
}

suite.addBatch({
  'request to /sign_in': {
    topic: function() {
      this.origSendMetricsValue = config.get('kpi.send_metrics');
      config.set('kpi.send_metrics', true);

      sendRequestToMetricsMiddleware('/sign_in', 'https://123done.org');
      return kpiTransport.getItem('signin');
    },
    "sends metrics fields to logger": function (entry) {
      assert.equal(entry.rp, 'https://123done.org');
    },
    "reset kpi.send_metrics": function() {
      config.set('kpi.send_metrics', this.origSendMetricsValue);
    }
  }
});

suite.addBatch({
  'request to /sign_in?AUTH_RETURN': {
    topic: function() {
      this.origSendMetricsValue = config.get('kpi.send_metrics');
      config.set('kpi.send_metrics', true);

      sendRequestToMetricsMiddleware('/sign_in?AUTH_RETURN');
      return kpiTransport.getItem('idp.auth_return');
    },
    "kpi transport logs metric": function(entry) {
      assert.equal(entry.idp, 'https://sendmypin.org');
    },
    "reset kpi.send_metrics": function() {
      config.set('kpi.send_metrics', this.origSendMetricsValue);
    }
  }
});

suite.addBatch({
  'request to /sign_in?AUTH_RETURN_CANCEL': {
    topic: function() {
      this.origSendMetricsValue = config.get('kpi.send_metrics');
      config.set('kpi.send_metrics', true);

      sendRequestToMetricsMiddleware('/sign_in?AUTH_RETURN_CANCEL');
      return kpiTransport.getItem('idp.auth_cancel');
    },
    "kpi transport logs metric": function(entry) {
      assert.equal(entry.idp, 'https://sendmypin.org');
    },
    "reset kpi.send_metrics": function() {
      config.set('kpi.send_metrics', this.origSendMetricsValue);
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
