#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const 
assert = require('assert'),
http = require('http'),
path = require('path'),
spawn = require('child_process').spawn,
url = require('url'),
vows = require('vows');

var suite = vows.describe('ssl-proxy-wsapi-cookie');
suite.options.error = false;

process.env.CONFIG_FILES = path.join(__dirname, '..', 'config', 'local.json');
process.env.BROWSERID_URL = 'http://127.0.0.1:10007';
process.env.DBWRITER_URL = 'http://127.0.0.1:10004';
process.env.LOG_TO_CONSOLE = 1;

function waitForStartup(proc, cb) {
  proc.stdout.on('data', function(buf) {
    buf.toString().split('\n').forEach(function(line) {
      if (/^.*running on http/.test(line)) {
        cb();
      }
    });
  });
}

function handleCookie(str) {
  var cookie = {};
  str.split(/\s*;\s*/).forEach(function(pair) {
    pair = pair.split('=');
    cookie[pair[0]] = pair[1] || null; 
  });
  return cookie;
}

function addTest(publicUrl) {
  var pathToBrowserid = path.join(__dirname, '..', "bin", "browserid");
  var childProcess;
  var scheme = url.parse(publicUrl).protocol;

  suite.addBatch({
    "run the server": {
      topic: function() {
        // The value of PUBLIC_URL will influence whether the browserid daemon
        // acts as if it is behind an SSL proxy or not.
        process.env.PUBLIC_URL = publicUrl;
        childProcess = spawn('node', [ pathToBrowserid ]);
        waitForStartup(childProcess, this.callback);
      },
      "and a wsapi request": {
        topic: function() {
          var url = process.env.BROWSERID_URL + '/wsapi/session_context';
          http.get(url, this.callback);
        },
        "returns 200 OK with a valid cookie": function (res) {
          assert.equal(res.statusCode, 200, '/wsapi/session_context returns 200');
          assert.isTrue('set-cookie' in res.headers, 'set-cookie header returned');
          var header = res.headers['set-cookie'];
          assert.equal(header.length, 1);
          header = header[0];
          var cookie = handleCookie(header);
          assert.isTrue('httponly' in cookie);
          assert.isTrue('expires' in cookie);
          assert.strictEqual(cookie.path, '/wsapi');
          assert.isTrue(new Date(cookie.expires).getTime() - Date.now() > 1000);
          if (scheme === 'https:') {
            assert.isTrue('secure' in cookie, "cookie has 'secure' flag");
            assert.isTrue('strict-transport-security' in res.headers,
                          "response has 'strict-transport-security' header");
            var sts = res.headers['strict-transport-security'];
            assert.isTrue(/max-age/.test(sts));
          }
        },
        "stop the server": {
          topic: function() {
            childProcess.kill();
            childProcess.on('exit', this.callback);
          },
          "stopped": function() {
            assert.ok('done');
          }
        }
      }
    }
  });
}

addTest('http://127.0.0.1:10002');
addTest('https://127.0.0.1:10002');

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
