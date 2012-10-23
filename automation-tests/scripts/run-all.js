#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Notes on usage:
 * The environment variable RUNNERS is used to specify the number of
 * parallel test runners to be used. If none are specified,
 * only one will be used.
 *
 * The environment variable PERSONA_ENV is used to specify which environment
 * should be tested.
 */

const path = require('path'),
      util = require('util'),
      child_process = require('child_process'),
      test_finder = require('../lib/test_finder'),
      runner = require('../lib/runner'),
      max_runners = parseInt(process.env['RUNNERS'] || 1, 10);

function runTest(testName, testPath, done) {
  util.puts("starting " + testName);

  var execCmd = "node " + testPath;
  var testProcess = child_process.exec(execCmd);

  testProcess.stdout.on('data', function (data) {
    util.print(data.toString());
  });

  testProcess.stderr.on('data', function (data) {
    util.error(data.toString());
  });

  testProcess.on('exit', function() {
    util.puts("finished " + testName);
    done && done();
  });
};

// the tests array is shared state across all invocations of runNext. If two or
// more tests are run in parallel, they will all check the tests array to see
// if there are any more tests to run.
var tests = test_finder.find();
console.log("Running", tests.length, "suites across", max_runners, "runners");
runTests(tests);

function runNext() {
  var test = tests.shift();

  if (test) {
    var testPath = test.path;
    var testName = test.name;

    runTest(testName, testPath, runNext);
  }
};

function runTests(tests) {
  // run tests in parallel up to the maximum number of runners.
  for(var i = 0; i < max_runners; ++i) {
    runNext();
  }
}


