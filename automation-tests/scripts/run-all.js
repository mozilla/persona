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

const path                = require('path'),
      util                = require('util'),
      child_process       = require('child_process'),
      glob                = require('minimatch'),
      test_finder         = require('../lib/test-finder'),
      runner              = require('../lib/runner'),
      toolbelt            = require('../lib/toolbelt'),
      FileReporter        = require('../lib/reporters/file-reporter'),
      StdErrReporter      = require('../lib/reporters/std-err-reporter'),
      vows_path           = path.join(__dirname, "../node_modules/.bin/vows"),
      vows_args           = process.env.VOWS_ARGS || ["-i", "-v"], // XXX is it cool to expect an array?
      supported_platforms = require('../lib/sauce-platforms').platforms,
      vows_reporters      = require('../config/vows-reporters'),
      start_time          = new Date().getTime();

var argv = require('optimist')
  .usage('Run automation tests.\nUsage: $0')
  .alias('help', 'h')
  .describe('help', 'display this usage message')
  .alias('list-platforms', 'lp')
  .describe('lp', 'list available platforms to test on')
  .alias('env', 'e')
  .describe('env', "the environment to test.  one of dev/stage/prod or the name of an ephemeral instance")
  .alias('local', 'l')
  .describe('local', 'run tests locally (instead of on saucelabs)')
  .check(function(a) {
    if (a.local) process.env.PERSONA_NO_SAUCE = '1';
  })
  .alias('parallel', 'p')
  .describe('parallel', 'the number of tests to run at the same time')
  .check(function(a) {
    if (!a.parallel) a.parallel = parseInt(process.env.RUNNERS, 10) || 10;
  })
  .describe('platform', 'the browser/os to test (globs supported)')
  .alias('list-tests', 'lt')
  .describe('list-tests', 'list available tests')
  .alias('tests', 't')
  .describe('tests', 'which test(s) to run (globs supported)')
  .default("tests", "*")
  .alias('list-reporters', 'lr')
  .describe('list-reporters', 'which output reporters are available')
  .alias('reporter', 'r')
  .describe('reporter', 'the output reporter type to use')
  .default('reporter', 'xunit')
  .check(function(a) {
    if(a.reporter && !vows_reporters[a.reporter]) {
      throw "invalid reporter: " + a.reporter;
    }
  });

var args = argv.argv;

if (args.h) {
  argv.showHelp();
  process.exit(0);
}

// optimist only runs "check" if an option is defined. Since we are checking if
// an option is not defined, its check has to be outside of the option.
if (!args.platform && !process.env.PERSONA_NO_SAUCE) {
  args.platform = process.env.PERSONA_BROWSER || "vista_chrome";
}
// all is a supported alias "match everything"
if (args.platform === 'all') args.platform = "*";

// propogate -e to the environment if present
if (args.env) process.env.PERSONA_ENV = args.env;

// what mode are we in?
if (args['list-tests']) {
  var testSet = test_finder.find();
  console.log("%s tests available:", testSet.length);
  testSet.forEach(function(test) {
    console.log("  *", test.name);
  });
} else if (args['list-platforms']) {
  var platforms = Object.keys(supported_platforms);
  console.log("%s platforms configured:", platforms.length);
  platforms.forEach(function(plat) {
    console.log("  *", plat);
  });
} else if (args['list-reporters']) {
  var reporters = Object.keys(vows_reporters);
  console.log("%s supported reporters:", reporters.length);
  reporters.forEach(function(reporter) {
    console.log("  *", reporter);
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
  var platforms = args.platform ? getTestedPlatforms(args.platform) : { any: {} };
  var tests = getTheTests(platforms);
  console.log("Running %s suites on %s platforms, %s at a time against %s",
              tests.length, Object.keys(platforms).length, args.parallel,
              require('../lib/urls.js').persona);
  runTests();

  function getTestedPlatforms(platform_glob) {
    var platforms = {};

    Object.keys(supported_platforms).forEach(function(p) {
      if (glob(p, platform_glob)) platforms[p] = supported_platforms[p];
    });

    return platforms;
  }

  function getTheTests(platforms) {
    var testSet = test_finder.find(args.tests);
    allTests = [];

    // make a copy of the test set for each platform, set the platform of each
    // test, and append the platform specific test set to overall list of
    // tests.
    for (var platform in platforms) {
      // create a deep copy of the testSet so that we can modify each set
      // without worrying about shared properties.
      var platformTests = [].concat(toolbelt.deepCopy(testSet));
      setPlatformOfTests(platformTests, platform);
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
    // platform if it is available. PERSONA_PLATFORM will only be set
    // if it is defined.
    var env = toolbelt.copyExtendEnv({
      PERSONA_BROWSER: platform
    });

    var opts = {
      cwd: undefined,
      env: env
    };

    // tell vows which reporter to use.
    var vowsArgs = [ testPath, '--' + args.reporter ].concat(vows_args);
    var testProcess = child_process.spawn(vows_path, vowsArgs, opts);

    testProcess.stdout.on('data', function (data) {
      stdOutReporter.report(data.toString());
    });

    testProcess.stderr.on('data', function (data) {
      data.toString().split("\n").forEach(function(line) {
        line = prettifyLine(line);
        if (line) {
          stdErrReporter.report(testName + ' | ' + platform + ' | ' + line + "\n");
        }
      });
    });

    testProcess.on('exit', function(code) {
      util.puts(testName + ' | ' + platform + ' | ' + "finished" +
                (code != 0 ? " (failed with exit code " + code + ")": ""));
      done && done();
    });
  }

  function prettifyLine(line) {
    // decolorize
    line = line.replace(/\x1b\[([0-9]{1,3}((;[0-9]{1,3})*)?)?[m|K]/, "");
    line = line.trim();
    // skip blank lines
    if (!line.length) return;
    // skip useless lines
    if (/Ending your web drivage/.test(line)) return;
    // transform sauce lab ids into urls you can load into your browser
    var m = /^.*Driving the web.*: ([a-z0-9]+).*$/.exec(line);
    if (m) {
      if (process.env.PERSONA_NO_SAUCE) line = "id: " + m[1];
      else line = 'https://saucelabs.com/tests/' + m[1];
    }

    return line;
  }

  function runNext() {
    var test = tests.shift();

    if (test) {
      var testName = test.name,
      platform = test.platform;

      var extension = vows_reporters[args.reporter].extension;

      var outputPath = path.join(__dirname, '..', 'results',
                                 start_time + "-" + testName + '-' + platform + '.' + extension);

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

