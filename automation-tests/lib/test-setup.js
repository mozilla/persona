


var saucePlatforms = require('./sauce-platforms.js'),
  wd = require('wd'),
  testSetup = {};

require('./wd-extensions.js');

// startup determines if browser sessions will be local or use saucelabs.
// should only be called once per session (potentially, once for many tests)
//
// saucelabs is used if:
//  - opts include sauceUser and sauceApiKey or
//  - env vars include PERSONA_SAUCE_USER and PERSONA_SAUCE_APIKEY
//
// opts may also include
//  - platform (a browser from the list in lib/sauce_platforms)
//  - desiredCapabilities (see json wire protocol for list of capabilities)
// env var equivalents are PERSONA_BROWSER and PERSONA_BROWSER_CAPABILITIES
testSetup.startup = function(opts) {

  _setSessionOpts(opts);

  var opts = opts || {},
    sauceUser = opts.sauceUser || process.env['PERSONA_SAUCE_USER'],
    sauceApiKey = opts.sauceApiKey || process.env['PERSONA_SAUCE_APIKEY'],
    browser;

  if (sauceUser && sauceApiKey) {
    browser = wd.remote('ondemand.saucelabs.com', 80, sauceUser, sauceApiKey);
    browser.on('status', function(info){
      // using console.error so we don't mix up plain text with junitxml
      // TODO do something nicer with this
      console.error('\x1b[36m%s\x1b[0m', info);
    });
  } else {
    browser = wd.remote();
  }

  var id = testSetup.browsers.push(browser);
  return id - 1;
}

// store multiple browsers until we can switch between sessions via d
testSetup.browsers = []

// these session opts aren't needed until the user requests a session via newSession()
// but we harvest them from the command line at startup time
function _setSessionOpts(opts) {
  var sessionOpts = {},
    opts = opts || {};

  // check for typos: throw error if requestedPlatform not found in list of supported sauce platforms
  var requestedPlatform = opts.platform || process.env['PERSONA_BROWSER'];
  if (requestedPlatform && !saucePlatforms.platforms[requestedPlatform]) {
    cb(new Error('requested platform ' + requestedPlatform + ' not found in list of available platforms'))
  }
  var platform = requestedPlatform ? saucePlatforms.platforms[requestedPlatform] : '';

  // add platform, browserName, version to session opts
  for (var opt in platform) { sessionOpts[opt] = platform[opt] }

  // pull the default desired capabilities out of the sauce-platforms file
  // overwrite if specified by user
  var desiredCapabilities = opts.desiredCapabilities || process.env['PERSONA_BROWSER_CAPABILITIES'] || {};
  for (var opt in saucePlatforms.defaultCapabilities) { sessionOpts[opt] = saucePlatforms.defaultCapabilities[opt] }
  for (var opt in desiredCapabilities) { sessionOpts[opt] = desiredCapabilities[opt] }

  testSetup.sessionOpts = sessionOpts;
}

// override testSetup.sessionOpts with opts, if set
testSetup.mergeOpts = function(opts) {
  var capabilities = {};
  if (opts) {
    for (var o in testSetup.sessionOpts) { capabilities[o] = testSetup.sessionOpts[o]; }
    for (var o in opts) { capabilities[o] = opts[o]; }
  }
  return capabilities;
}

module.exports = testSetup;
