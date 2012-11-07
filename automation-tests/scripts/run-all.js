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

var argv = require('optimist')
  .usage('Run automation tests.\nUsage: $0')
  .alias('help', 'h')
  .describe('help', 'display this usage message')
  .alias('list-platforms', 'lp')
  .describe('lp', 'list available platforms to test on')
  .alias('env', 'e')
  .describe('env', "the environment to test.  one of dev/stage/prod or the name of an ephemeral instance")
  .alias('parallel', 'p')
  .describe('parallel', 'the number of tests to run at the same time')
  .check(function(a, b) {
    if (!a.parallel) a.parallel = parseInt(process.env.RUNNERS, 10) || 10;
  })
  .describe('platform', 'the browser/os to test (globs supported)')
  .check(function(a, b) {
    if (!a.platform) a.platform = process.env.PERSONA_BROWSER || "vista_chrome";
    // all is a supported alias "match everything"
    if (a.platform === 'all') a.platform = "*";
  })
  .alias('list-tests', 'lt')
  .describe('list-tests', 'list available tests')
  .alias('tests', 't')
  .describe('tests', 'specify a glob for to match a subset of tests')
  .default("tests", "*");

var args = argv.argv;

if (args.h) {
  argv.showHelp();
  process.exit(0);
}

// propogate -e to the environment if present
if (args.env) process.env.PERSONA_ENV = args.env;

const path = require('path'),
      util = require('util'),
      child_process = require('child_process'),
      test_finder = require('../lib/test_finder'),
      runner = require('../lib/runner'),
      toolbelt = require('../lib/toolbelt'),
      FileReporter = require('../lib/reporters/file_reporter'),
      StdOutReporter = require('../lib/reporters/std_out_reporter'),
      StdErrReporter = require('../lib/reporters/std_err_reporter'),
      vows_path = path.join(__dirname, "../node_modules/.bin/vows"),
      vows_args = process.env.VOWS_ARGS || ["--xunit", "-i"], // XXX is it cool to expect an array?
      result_extension = process.env.RESULT_EXTENSION || "xml",
      supported_platforms = require('../lib/sauce-platforms').platforms,
      start_time = new Date().getTime(),
      glob = require('minimatch');

// what mode are we in?
if (args['list-tests']) {
  var testSet = test_finder.find();
  console.log("%s tests available:", testSet.length);
  testSet.forEach(function(test) {
    console.log("  *", test.name);
  });
} else if (args['list-platforms']) {
  var plats = Object.keys(supported_platforms);
  console.log("%s platforms configured:", plats.length);
  plats.forEach(function(plat) {
    console.log("  *", plat);
  });
} else {
  startTesting();
}

function startTesting() {
  // General flow
  // 1. Get the list of tests for the specified platforms
  // 2. Run the tests in parallel with a max of args.parallel jobs.
  // 3. Report the results.

  // the tests array is shared state across all invocations of runNext. If two or
  // more tests are run in parallel, they will all check the tests array to see
  // if there are any more tests to run.
  var plats = getTestedPlatforms(args.platform);
  var tests = getTheTests(plats);
  console.log("Running %s, suites on %s platforms, %s at a time against %s",
              tests.length, Object.keys(plats).length, args.parallel,
              require('../lib/urls.js').persona);
  runTests();

  function getTestedPlatforms(platform_glob) {
    var plats = [];
    Object.keys(supported_platforms).forEach(function(p) {
      if (glob(p, platform_glob)) plats.push(supported_platforms[p]);
    });
    return plats;
  }

  function getTheTests(platforms) {
    var testSet = test_finder.find(null, null, args.tests),
    allTests = [];

    // make a copy of the test set for each platform, set the platform of each
    // test, and append the platform specific test set to overall list of
    // tests.
    for (var key in platforms) {
      // create a deep copy of the testSet so that we can modify each set
      // it worrying about shared properties.
      var platformTests = [].concat(toolbelt.deepCopy(testSet));
      setPlatformOfTests(platformTests, key);
      allTests = allTests.concat(platformTests);
    }

    return allTests;
  }

  function setPlatformOfTests(tests, platform) {
    tests.forEach(function(test) {
      test.platform = platform;
    });
  }

  function runTest(test, stdOutReporter, stdErrReporter, done) {
    var testName = test.name,
    testPath = test.path,
    platform = test.platform;

    util.puts(testName + ' | ' + platform + ' | ' + "starting");

    // make a copy of the current process' environment but force the
    // platform if it is available
    var env = toolbelt.copyExtendEnv({
      PERSONA_BROWSER: platform
    });

    var opts = {
      cwd: undefined,
      env: env
    };

    var testProcess = child_process.spawn(vows_path,
                                          [testPath].concat(vows_args), opts);

    testProcess.stdout.on('data', function (data) {
      stdOutReporter.report(data.toString());
    });

    testProcess.stderr.on('data', function (data) {
      // annoyingly, wd puts lots of newlines into the stderr output
      stdErrReporter.report(testName + ' | ' + platform + ' | ' + data.toString());
    });

    testProcess.on('exit', function() {
      util.puts(testName + ' | ' + platform + ' | ' + "finished");
      done && done();
    });
  }

  function runNext() {
    var test = tests.shift();

    if (test) {
      var testName = test.name,
      platform = test.platform;

      var outputPath = path.join(__dirname, '..', 'results',
                                 start_time + "-" + testName + '-' + platform + '.' + result_extension);

      var stdOutReporter = new FileReporter({
        output_path: outputPath
      });
      var stdErrReporter = new StdErrReporter();

      runTest(test, stdOutReporter, stdErrReporter, function() {
        stdOutReporter.done();
        stdErrReporter.done();

        runNext();
      });
    }
  }

  function runTests() {
    // run tests in parallel up to the maximum number of runners.
    for(var i = 0; i < args.parallel; ++i) {
      runNext();
    }
  }
}

