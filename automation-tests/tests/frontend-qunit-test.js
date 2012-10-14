#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
assert = require('assert'),
utils = require('../lib/utils.js'),
vowsHarness = require('../lib/vows_harness.js'),
testSetup = require('../lib/test-setup.js');

// Intentionally hardcoded to dev instance. This test cannot be run in
// either stage or prod. (Although can be run against ephemeral via env).
var frontendTestUrl = (process.env.PERSONA_FRONTEND_TESTURL ||
                       'https://login.dev.anosrep.org/test/');

// The test page has jquery and underscore available.
var queryResult = [
  "(function() {                                               ",
  "  var result = $('#qunit-testresult').text();               ",
  "  if (result.indexOf('Tests completed') === -1) {           ",
  "    return '{}';                                            ",
  "  }                                                         ",
  "  var elapsed = result.match(/(\\d+)\\s+millis/)[1];        ",
  "  var passFail =                                            ",
  "    _.map(['total', 'passed', 'failed'], function(clazz) {  ",
  "      var selector = '#qunit-testresult .' + clazz;         ",
  "      return $(selector).text();                            ",
  "    });                                                     ",
  "  return JSON.stringify({                                   ",
  "    elapsed: elapsed,                                       ",
  "    total: passFail[0],                                     ",
  "    passed: passFail[1],                                    ",
  "    failed: passFail[2],                                    ",
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

// pull in test environment, including wd
var browser;
testSetup.setup({b:1}, function(err, fix) {
  browser = fix.b[0];
});

vowsHarness({
  "create a new selenium session": function(done) {
    browser.newSession(testSetup.sessionOpts, done);
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
            result: JSON.parse(res),
            failures: JSON.parse(failures),
          });
        });
      });
    };
    var complete = function complete(res) {
      //XXX should have a better way to save off the elapsed time, test
      // counts, pass/fail, etc., somewhere better than just dumping it in the
      // console. Maybe set custom-data for Sauce after the job completes?
      // - Should have a mode here where we just return the `res` back to 
      // a parallel test runner, which can then make assertions about
      // all the results.
      console.dir(res);
      assert.equal(res.result.failed, '0', 'no tests failed');
      done();
    };
    // The frontend tests take at least 20 seconds to run locally (FF); Chrome
    // on ICS is the worst locally at >1500s, with stock on ICS at
    // ~500s. Running on Sauce takes longer than locally.  So we need to set
    // the timeout quite high.
    utils.waitFor(20000, 15*60*1000, check, complete);
  },
  "shut down": function(done) {
    browser.quit();
    done();
  }
}, module);
