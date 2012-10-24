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
      FileReporter = require('../lib/reporters/file_reporter'),
      StdOutReporter = require('../lib/reporters/std_out_reporter'),
      StdErrReporter = require('../lib/reporters/std_err_reporter'),
      max_runners = parseInt(process.env['RUNNERS'] || 1, 10),
      vows_path = "../node_modules/.bin/vows",
      vows_args = process.env['VOWS_ARGS'] || "--xunit",
      result_extension = process.env['RESULT_EXTENSION'] || "xml",
      start_time = new Date().getTime();

function runTest(testName, testPath, stdOutReporter, stdErrReporter, done) {
  util.puts("starting " + testName);

  var testProcess = child_process.spawn(vows_path, [testPath, vows_args]);

  testProcess.stdout.on('data', function (data) {
    stdOutReporter.report(data.toString());
  });

  testProcess.stderr.on('data', function (data) {
    stdErrReporter.report(data.toString());
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

    var stdOutReporter = new FileReporter({
      output_path: path.join(__dirname, '..', 'results',
        start_time + "-" + testName + '.' + result_extension)
    });
    var stdErrReporter = new StdErrReporter();

    runTest(testName, testPath, stdOutReporter, stdErrReporter, function() {
      stdOutReporter.done();
      stdErrReporter.done();

      runNext();
    });
  }
};

function runTests(tests) {
  // run tests in parallel up to the maximum number of runners.
  for(var i = 0; i < max_runners; ++i) {
    runNext();
  }
}


