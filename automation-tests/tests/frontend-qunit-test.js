#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

const
assert = require('../lib/asserts.js'),
utils = require('../lib/utils.js'),
runner = require('../lib/runner.js'),
persona_urls = require('../lib/urls.js'),
fs = require('fs'),
os = require('os'),
path = require('path'),
testSetup = require('../lib/test-setup.js');

// target the proper instance (modified by run-all.js -e or PERSONA_ENV
// environment variable, just like all the other automation tests)
var frontendTestUrl = persona_urls['persona'] + '/test/';

// The test page has jquery and tinyscore available.
var queryResult = [
  "(function() {                                               ",
  "  var result = $('#qunit-testresult').text();               ",
  "  if (result.indexOf('Tests completed') === -1) {           ",
  "    return '{}';                                            ",
  "  }                                                         ",
  "  var elapsed = result.match(/(\\d+)\\s+millis/)[1];        ",
  "  var passFail = {};                                        ",
  "  _.each(['total', 'passed', 'failed'], function(clazz) {   ",
  "    var selector = '#qunit-testresult .' + clazz;           ",
  "    passFail[clazz] = $(selector).text();                   ",
  "  });                                                       ",
  "  return JSON.stringify({                                   ",
  "    elapsed: elapsed,                                       ",
  "    total: passFail.total,                                  ",
  "    passed: passFail.passed,                                ",
  "    failed: passFail.failed,                                ",
  "    ua: navigator.userAgent,                                ",
  "  });                                                       ",
  "})();                                                       ",
].join(' ').replace(/\s+/g, ' ');

var queryFailures = [
  "(function() {                                               ",
  "  var failures = $('#qunit-tests > li.fail > strong')       ",
  "    .map(function() { return $(this).text() }).get();       ",
  "  return JSON.stringify(failures);                          ",
  "})();                                                       ",
].join(' ').replace(/\s+/g, ' ');

var browser;

runner.run(module, {
  "create a new selenium session": function(done) {
    testSetup.setup({b:1}, function(err, fix) {
      if (fix) {
        browser = fix.b[0];
      }
      done(err);
    });
  },
  "start the session": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  "open the frontend test url": function(done) {
    browser.get(frontendTestUrl, done);
  },
  "waitFor and check/complete the result": function(done) {
    var check = function check(checkCb) {
      /*jshint evil:true */
      browser.eval(queryResult, function(err, res) {
        if (err) throw err;
        if (res === '{}') return checkCb(false);
        browser.eval(queryFailures, function(err, failures) {
          if (err) throw err;
          return checkCb(true, {
            date: new Date().toISOString(),
            result: JSON.parse(res),
            failures: JSON.parse(failures),
          });
        });
      });
    };
    var complete = function complete(res) {
      // If it fails, we'll want to know which test(s) failed.
      var filename = process.env.FRONTENDQUNIT ||
        'frontend-' + new Date().toISOString().split('T')[0] + '.log';
      filename = path.join(os.tmpDir(), filename);
      fs.appendFileSync(filename, JSON.stringify(res) + '\n');
      done(assert.equal(res.result.failed, '0'));
    };
    // The frontend tests take at least 20 seconds to run locally (FF); Chrome
    // on ICS is the worst locally at >1500s, with stock on ICS at
    // ~500s. Running on Sauce takes longer than locally.  So we need to set
    // the timeout quite high.
    utils.waitFor(20000, 15*60*1000, check, complete);
  },
  "shut down": function(done) {
    browser.quit(done);
  }
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});
