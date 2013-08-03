const vowsHarness = require('../lib/vows_harness.js');

var alltests = {},
  rawSuites = [],
  globalCount = 0;

// register just pushes suites onto a master list
function register(suites) {
  if (!suites.length) suites = [suites];
  rawSuites = rawSuites.concat(suites);
}

// run runs previously-registered suites. for convenience,
// you can just pass suites into run as well.
function run(mod, suites, opts) {
  if (suites) register(suites);

  rawSuites.forEach(function(suite) {
    for (var vow in suite) {
      globalCount++;
      // vows with duplicate names cause great sadness; use a counter to ensure
      // each name is unique
      alltests[globalCount + ': ' + vow] = suite[vow];
    }
  });

  vowsHarness(alltests, mod, opts);
}

exports.run = run;
exports.register = register;
