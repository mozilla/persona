#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
assert = require('assert'),
utils = require('../lib/utils.js'),
vowsHarness = require('../lib/vows_harness.js'),
testSetup = require('../lib/test-setup.js');

/*
  This test does not currently succeed via Saucelabs for XP IE8, but 
  does succeed for other browser/OS combinations on Sauce.
*/

// Intentionally hardcoded to dev instance. This test cannot be run in 
// either stage or prod. (Although can be run against ephemeral).
var devTestUrl = 'https://login.dev.anosrep.org/test/';

var queryResult = [
  "(function() {                                           ",
  "  var result = $('#qunit-testresult').text();           ",
  "  if (result.indexOf('Tests completed')=== -1) {        ",
  "    return JSON.stringify({});                          ",
  "  }                                                     ",
  "  var elapsed = result.match(/(\\d+)\\s+millis/)[1];    ",
  "  var passFail =                                        ",
  "    ['total', 'passed', 'failed'].map(function(clazz) { ",
  "      var selector = '#qunit-testresult .' + clazz;     ",
  "      return $(selector).text();                        ",
  "    });                                                 ",
  "  return JSON.stringify({                               ",
  "    elapsed: elapsed,                                   ",
  "    total: passFail[0],                                 ",
  "    passed: passFail[1],                                ",
  "    failed: passFail[2],                                ",
  "  });                                                   ",
  "})();                                                   ",
].join('\n');
//.join(' ').replace(/\s+/g, ' ') // more compact

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
    browser.get(devTestUrl, done);
  },
  "waitFor and check the result": function(done) {
    function check(checkCb) {
      browser.eval(queryResult, function(err, res) {
        if (err) throw err;
        if (res === '{}') return checkCb(false);
        return checkCb(true, res);
      });
    };
    function complete(res) {
      assert.ok(!!res, 'The test returned a value');
      res = JSON.parse(res);
      //XXX should have a better way to save off the elapsed time, test
      // counts, pass/fail, etc., somewhere better than just dumping it in the
      // console. Maybe set custom-data for Sauce after the job completes?
      console.dir(res);
      assert.strictEqual(res.failed, '0', 'no tests failed');
      done();
    };
    // The frontend tests take at least 20 seconds to run (FF); IE8 is the
    // worst at around 200s. Running on Sauce takes longer than locally.
    utils.waitFor(20000, 500000, check, complete);
  },
  "shut down": function(done) {
    browser.quit();
    done();
  }
}, module);
