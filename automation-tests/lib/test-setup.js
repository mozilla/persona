const
personatestuser = require('../lib/personatestuser.js'),
Q = require('q'),
restmail = require('../lib/restmail.js'),
saucePlatforms = require('./sauce-platforms.js'),
wd = require('wd'),
path = require('path'),
_ = require('underscore');

require('./wd-extensions.js');

var testSetup = {};

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
  opts = opts || {};
  _setSessionOpts(opts);

  var sauceUser = opts.sauceUser || process.env['PERSONA_SAUCE_USER'],
    sauceApiKey = opts.sauceApiKey || process.env['PERSONA_SAUCE_APIKEY'],
    browser;

  if (sauceUser && sauceApiKey && !process.env.PERSONA_NO_SAUCE) {
    browser = wd.remote('ondemand.saucelabs.com', 80, sauceUser, sauceApiKey);
  } else {
    browser = wd.remote();
  }

  browser.on('status', function(info) {
    // using console.error so we don't mix up plain text with junitxml
    // TODO do something nicer with this
    var format = process.env.NODE_DISABLE_COLORS ? '%s' : '\x1b[36m%s\x1b[0m';
    console.error(format, info);
  });

  var id = testSetup.browsers.push(browser);
  return id - 1;
}

// store multiple browsers until we can switch between sessions via d
testSetup.browsers = []

// these session opts aren't needed until the user requests a session via newSession()
// but we harvest them from the command line at startup time
function _setSessionOpts(opts) {
  opts = opts || {};
  var sessionOpts = {};

  // check for typos: throw error if requestedPlatform not found in list of supported sauce platforms
  var requestedPlatform = opts.platform || process.env['PERSONA_BROWSER'];
  if (requestedPlatform && !saucePlatforms.platforms[requestedPlatform]) {
    throw new Error('requested platform ' + requestedPlatform +
                    ' not found in list of available platforms');
  }
  // Default to chrome which does not need a version number.
  var defaultPlatform = { browserName: 'chrome', platform: 'VISTA' };
  var platform = requestedPlatform ? saucePlatforms.platforms[requestedPlatform] : defaultPlatform;

  // add platform, browserName, version to session opts
  _.extend(sessionOpts, platform);

  // pull the default desired capabilities out of the sauce-platforms file
  // overwrite if specified by user
  var desiredCapabilities = opts.desiredCapabilities || process.env['PERSONA_BROWSER_CAPABILITIES'] || {};
  _.extend(sessionOpts, saucePlatforms.defaultCapabilities);
  _.extend(sessionOpts, desiredCapabilities);

  if (sessionOpts.browserName === 'opera' && !sessionOpts.proxy) {
    // TODO reportedly works for opera; investigate
    sessionOpts.proxy = { proxyType: 'direct' };
  }

  // Ensure there is a tag for 'persona'
  sessionOpts.tags = sessionOpts.tags || [];
  if (sessionOpts.tags.indexOf('persona') === -1) {
    sessionOpts.tags.push('persona');
  }

  // Ensure a test name for saucelabs
  if (!sessionOpts.name) sessionOpts.name = createTestName();

  testSetup.sessionOpts = sessionOpts;
}

// opts could be of the form:
// { browsers: 2, restmails: 1, eyedeemails: 1, personatestusers: 2
// or of the form
// { b:2, r:1, e:1, p:2 }
// just be polite and don't mix the two.
//
// cb could be of the form:
// function(err, fixtures) {
//   // either these are global or you declared them in outer scope
//   browser = fixtures.browsers[0];
//   secondBrowser = fixtures.browsers[1];
//   theEmail = fixtures.restmails[0];
//   eyedeemail = fixtures.eyedeemails[0];
//   firstUser = fixtures.personatestusers[0];
//   secondUser = fixtures.personatestusers[1];
// }
testSetup.setup = function(opts, cb) {
  var fixtures = {},
    restmails = opts.restmails || opts.r,
    eyedeemails = opts.eyedeemails || opts.e,
    personatestusers = opts.personatestusers || opts.p,
    browsers = opts.browsers || opts.b,
    promises = [];

  if (restmails) {
    fixtures.r = fixtures.restmails = [];
    for (var i = 0; i < restmails; i++) {
      fixtures.restmails.push(restmail.randomEmail(10));
    }
  }
  if (eyedeemails) {
    fixtures.e = fixtures.eyedeemails = [];
    for (var i = 0; i < eyedeemails; i++) {
      fixtures.eyedeemails.push(restmail.randomEmail(10, 'eyedee.me'));
    }
  }
  if (personatestusers) {
    fixtures.p = fixtures.personatestusers = [];
    // after personatestuser returns, and pushes result onto list of users,
    // then the final promise will be resolved.
    for (var i = 0; i < personatestusers; i++) {
      var userPromise = Q.ncall(personatestuser.getVerifiedUser)
        .then(function(user) { fixtures.personatestusers.push(user[0]) })
        .fail(function(error) { return cb(error) });
      promises.push(userPromise);
    }
  }
  // no need to return a promise, just fire the cb when ready
  if (promises) { 
    Q.all(promises)
      .then(function() { 
        fixtures = setupBrowsers(browsers, fixtures);
        cb(null, fixtures) 
      })
      .fail(function(error) { cb(error) });
  } else {
    fixtures = setupBrowsers(browsers, fixtures);
    cb(null, fixtures)
  }
}

function setupBrowsers(browserCount, out) {
  for (var i = 0; i < browserCount; i++) { testSetup.startup() }
  // just use the browsers array directly
  out.b = out.browsers = testSetup.browsers;
  return out;
}

function createTestName() {
  var testname = path.basename(process.argv[1], '.js');
  if (testname === 'vows') {
    var isOption = function(elt) { return elt.indexOf('-') === 0; };
    testname = _.reject(process.argv.slice(2), isOption)[0];
    testname = path.basename(testname, '.js');
  }
  return [ 'persona', testname.replace(/\s+/g, '-') ].join('.');
}

module.exports = testSetup;
