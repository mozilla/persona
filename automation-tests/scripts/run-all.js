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

const sauce_platforms = require('../config/sauce-platforms'),
  local_platforms = require('../config/local-platforms');

const outputFormats = ["console", "json", "xunit"];


var argv = require('optimist')
  .usage('Run automation tests.\nUsage: $0')
  .alias('help', 'h')
  .describe('help', 'display this usage message')
  .alias('list-platforms', 'lp')
  .describe('lp', 'list available platforms to test on')
  .alias('env', 'e')
  .describe('env', "target environment: dev/stage/prod or the name of an ephemeral")
  .alias('local', 'l')
  .describe('local', 'run tests locally (instead of on saucelabs)')
  .check(function(a) {
    if (a.local) process.env.PERSONA_NO_SAUCE = '1';
  })
  .alias('parallel', 'p')
  .describe('parallel', 'the number of tests to run at the same time')
  .default('parallel', "10")
  .check(function(a) {
    if (!a.parallel) a.parallel = parseInt(process.env.RUNNERS, 10) || 10;
  })
  .describe('platform', 'the browser/os to test (globs and csv supported)')
  .alias('iterations', 'i')
  .describe('iterations', 'the number of times to repeat specified tests')
  .default("iterations", "1")
  .alias('list-tests', 'lt')
  .describe('list-tests', 'list available tests')
  .alias('tests', 't')
  .describe('tests', 'which test(s) to run (globs supported)')
  .default("tests", "*")
  .alias('output', 'o')
  .describe('output', 'desired ouput format.  one of ' + outputFormats.join(", "))
  .default("output", "console")
  .alias('ignore-tests', 'it')
  .describe('ignore-tests', 'test(s) to ignore (csv supported)')
  .check(function(a) {
    if (outputFormats.indexOf(a.output) === -1) {
      throw "unsupported output format: " + a.output;
    }
  });

var args = argv.argv;

if (args.h) {
  argv.showHelp();
  process.exit(0);
}

// switch between sauce and local platform list depending on results of
// parsing args.local or seeing PERSONA_NO_SAUCE in env vars
var config_platforms = process.env.PERSONA_NO_SAUCE ? local_platforms : sauce_platforms;

// optimist only runs "check" if an option is defined. Since we are checking if
// an option is not defined, its check has to be outside of the option.
if (!args.platform) {
  args.platform = process.env.PERSONA_BROWSER || config_platforms.defaultPlatform;
}
// all is a supported alias "match everything"
if (args.platform === 'all') args.platform = "*";

// propogate -e to the environment if present
if (args.env) process.env.PERSONA_ENV = args.env;

const path = require('path'),
      util = require('util'),
      child_process = require('child_process'),
      test_finder = require('../lib/test-finder'),
      runner = require('../lib/runner'),
      toolbelt = require('../lib/toolbelt'),
      FileReporter = require('../lib/reporters/file-reporter'),
      ResultsAggregator = require('../lib/results-aggregator'),
      StdOutReporter = require('../lib/reporters/std-out-reporter'),
      StdErrReporter = require('../lib/reporters/std-err-reporter'),
      vows_path = path.join(__dirname, "../node_modules/.bin/vows"),
      vows_args = [(args.output === 'xunit') ? "--xunit" : "--json", "-i"],
      result_extension = process.env.RESULT_EXTENSION || "xml",
      supported_platforms = config_platforms.platforms,
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
  var platforms = Object.keys(supported_platforms);
  console.log("%s platforms configured:", platforms.length);
  platforms.forEach(function(plat) {
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
  var platforms = args.platform ? getTestedPlatforms(args.platform) : { any: {} };
  if (Object.keys(platforms).length === 0) {
    console.log("You asked to use platform '%s', but that is not available. %s",
                args.platform, "Your choices are:");
    var supportedPlatforms = Object.keys(supported_platforms);
    supportedPlatforms.forEach(function(plat) {
      console.log("  *", plat);
    });
    process.exit(1);
  }

  var tests = getTheTests(platforms);
  var howManyAtOnce = (tests.length < args.parallel ? tests.length : args.parallel);
  console.log("Running %s suite(s) on %s platform(s), %s at a time against %s",
              tests.length, Object.keys(platforms).length, howManyAtOnce,
              require('../lib/urls.js').persona);
  runTests();

  function getTestedPlatforms(platform_glob) {
    var platforms = {};

    // see if it's CSV (but don't match a glob brace expansion)
    if (platform_glob.indexOf(',') > 0 && platform_glob.indexOf('{') !== 0) {
      var platformList = platform_glob.split(',');
      Object.keys(supported_platforms).forEach(function(p) {
        if (platformList.indexOf(p) !== -1) platforms[p] = supported_platforms[p];
      });
    } else {
      Object.keys(supported_platforms).forEach(function(p) {
        if (glob(p, platform_glob)) platforms[p] = supported_platforms[p];
      });
    }

    return platforms;
  }

  function getTheTests(platforms) {
    var testSet = test_finder.find(args.tests, '', '', args['ignore-tests']);
    var allTests = [];

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
    // handle multiple iterations
    var allTestsCopy = toolbelt.deepCopy(allTests);
    for (var i = 1; i < parseInt(args.iterations, 10); i++) {
      allTests = allTests.concat(allTestsCopy);
    }
    return allTests;
  }

  function setPlatformOfTests(tests, platform) {
    tests.forEach(function(test) {
      test.platform = platform;
    });
  }

  function runTest(test, aggregator, stdOutReporter, stdErrReporter, done) {
    var testName = test.name,
        testPath = test.path,
        platform = test.platform;

    if (args.output === 'xunit') {
      util.puts(testName + ' | ' + platform + ' | ' + "starting");
    }

    // make a copy of the current process' environment but force the
    // platform if it is available. PERSONA_PLATFORM will only be set
    // if it is defined.
    var env = toolbelt.copyExtendEnv({
      PERSONA_BROWSER: platform
    });

    var opts = {
      cwd: path.dirname(testPath),
      env: env
    };
    var testProcess = child_process.spawn(vows_path,
                                          [testPath].concat(vows_args), opts);

    testProcess.stdout.on('data', function (data) {
      var msg = data.toString().trim();

      if (aggregator) aggregator.parseLine(msg);
      if (stdOutReporter) stdOutReporter.report(msg);
    });

    testProcess.stderr.on('data', function (data) {
      // remove any leading newline characters and trim the rest of the output.
      var line = prettifyLine(data.toString().replace(/^[\r\n]+/, '').trim());
      if (!line) return;

      if (aggregator) aggregator.parseErrorLine(line);

      // output the line to console when we're in xunit mode
      if (args.output === 'xunit') {
        stdErrReporter.report(testName + ' | ' + platform + ' | ' + line + "\n");
      }
    });

    testProcess.on('exit', function(code) {
      var err = (code !== 0 ? " (failed with exit code " + code + ")": null);
      done && done(err);
    });
  }

  function prettifyLine(line) {
    // decolorize
    line = line.replace(/\x1b\[([0-9]{1,3}((;[0-9]{1,3})*)?)?[m|K]/g, "");
    line = line.trim();

    // skip blank lines
    if (!line.length) return;
    // skip useless lines
    if (/Ending your web drivage/.test(line)) return;
    // transform sauce lab ids into urls you can load into your browser
    var m = /^.*Driving the web.*: ([a-z0-9]+).*$/.exec(line);
    if (m) {
      if (process.env.PERSONA_NO_SAUCE) line = "id: " + m[1];
      else {
        line = 'https://saucelabs.com/tests/' + m[1];
      }
    }

    return line;
  }

  function runNext(aggregator, cb) {
    var test = tests.shift();

    if (test) {
      if (args.output === 'console') process.stdout.write(">");
      var testName = test.name,
      platform = test.platform;

      var outputPath = path.join(__dirname, '..', 'results',
                                 start_time + "-" + testName + '-' + platform + '.' + result_extension);
      if (aggregator) {
        aggregator.setName(testName + " - " + platform);
      }

      var stdOutReporter = null;
      if (args.output === 'xunit') {
        stdOutReporter = new FileReporter({
          output_path: outputPath
        });
      }
      var stdErrReporter = new StdErrReporter();

      runTest(test, aggregator, stdOutReporter, stdErrReporter, function(err) {
        if (stdOutReporter) stdOutReporter.done();
        stdErrReporter.done();
        if (cb) cb(err);
      });
    }
  }

  function setupSigIntHandler(aggregators) {
    // Sometimes, when running tests interactively from the command line,
    // things start going badly, and you don't want to wait for the end of the
    // test to find out what was failing. So, on SIGINT, show the state of the
    // aggregators before exiting.
    if (process.platform === 'win32') return; // signals are not supported
    process.on('SIGINT', function() {
      if (!aggregators.length) return process.exit(1);
      if (args.output === 'console') process.stdout.write("\n\n");
      summarizeResultsAndExit(aggregators);
    });
  }

  function runTests() {
    var aggregators = [];
    var totalTests = tests.length;
    var completeTests = 0;
    var allProcessesExitedCleanly = true;

    setupSigIntHandler(aggregators);

    function getAggregator() {
      var aggregator;
      if (args.output !== 'xunit') {
        aggregator = new ResultsAggregator();
        aggregators.push(aggregator);

        // now if this is the console, let's output marks as tests start and complete
        if (args.output === 'console') {
          aggregator.on('pass', function() { process.stdout.write("."); });
          aggregator.on('fail', function() { process.stdout.write("!"); });
        }
      }
      return aggregator;
    }

    function handleTestCompletion(err) {
      if (args.output === 'console') process.stdout.write("<");
      // now pass the error into the results parser to catch bad shutdown in our final report
      if (err) allProcessesExitedCleanly = false;
      // complete!  If all of the tests are done, it's time to summarize results if
      // we're not in xunit mode
      completeTests += 1;
      if (completeTests === totalTests) {
        if (args.output === 'console') process.stdout.write("\n\n");
        if (aggregators.length) {
          summarizeResultsAndExit(aggregators);
        } else {
          // exit with an error code that controlling processes can catch in xunit mode
          process.exit(allProcessesExitedCleanly ? 0 : 77);
        }
      } else {
        runNext(getAggregator(), handleTestCompletion);
      }
    }

    // run tests in parallel up to the maximum number of runners.
    for(var i = 0; i < args.parallel && tests.length; ++i) {
      runNext(getAggregator(), handleTestCompletion);
    }
  }

  function summarizeResultsAndExit(aggregators) {
    // first let's calculate uber-high level summary information
    var total = 0;
    var successes = 0;
    aggregators.forEach(function(rp) {
      var r = rp.results();
      total += r.passed + r.failed;
      successes += r.passed;
    });
    console.log("%s/%s tests passed%s", successes, total,
                (successes !== total) ? ", here are your failures:" : "");
    if (successes !== total) {
      aggregators.forEach(function(rp) {
        var r = rp.results();
        if (r.failed || r.unhandledMessages.length) {
          var warnings = r.unhandledMessages.length;
          console.log(r.name + " (%s failure(s), %s warnings):", r.failed, warnings);
          r.errorDetails.forEach(function(e) {
            console.log("  " + e.name + ", errors:");
            e.errors.forEach(function(err) {
              console.log("    * " + err);
            });
          });
          r.unhandledMessages.forEach(function(om) {
            console.log("  unexpected output:", om);
          });
          r.urls.forEach(function(u) {
            console.log("  >> " + u);
          });
        }
      });
    }
    process.nextTick(function() {
      process.exit(total - successes);
    });
  }
}
