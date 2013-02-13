#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env');

const _                       = require('underscore'),
      vows                    = require('vows'),
      assert                  = require('assert'),
      fs                      = require('fs'),
      path                    = require('path'),
      url                     = require('url'),
      start_stop              = require('./lib/start-stop'),
      resources               = require('../lib/static_resources'),
      respondsWithVow         = require('./lib/responds-with'),
      wsapi                   = require('./lib/wsapi.js');

/**
 * This set of tests check to make sure all of the expected font CSS files
 * are served up with the correct status codes and that all embedded fonts are
 * fetchable.
 *
 * The basic flow:
 * Get a list of all production resources for all locales
 * Search through the list of resources for all /fonts.css
 * Check to make sure all /fonts.css are fetchable.
 * Peak into each fonts.css file to look for embedded url(...)s
 * Fetch each embedded URL to make sure the font is served.
 */

// Vows can only handle up to 50 tests per batch. After 50, it just
// ignores the tests. Set it to 25, keep things sane.
const MAX_TESTS_PER_BATCH = 25;

// start the tests!
var suite = vows.describe('fonts.css requests');

// start up a pristine server
start_stop.addStartupBatches(suite);

/*
 * Get all of the font CSS paths from the list of production resources.
 */
var allFontCSSPaths = getFontCSSPaths();

/*
 * Once we have the list, create a batch per MAX_TESTS_PER_BATCH tests.
 */
var batch;
allFontCSSPaths.forEach(function(fontCSSPath, index) {
   if (!(index % MAX_TESTS_PER_BATCH)) {
     if (batch) suite.addBatch(batch);
     batch = {};
   }

   batch['GET ' + fontCSSPath] = respondsWithVow(200, function(err, res) {
     if (err) return this.callback(err);

     var done = this.callback;
     checkEmbeddedFonts(fontCSSPath, res.body, function(err) {
       done(err, res);
     });
   });
});

// Add the last batch
suite.addBatch(batch);

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);


function checkEmbeddedFonts(fontCSSPath, text, done) {
  var embeddedFontPaths = getEmbeddedFontPaths(text || "");
  if (!embeddedFontPaths.length) {
    return done(new Error("No embedded fonts in " + fontCSSPath));
  }

  checkFontPaths(embeddedFontPaths, done);
}

function getEmbeddedFontPaths(text) {
  var re = /url\('([^']*)'\)/gm;
  var match;
  var urls = {};
  while (match = re.exec(text)) {
    var foundURL = url.parse(match[1]).pathname;
    urls[foundURL] = true;
  }

  return Object.keys(urls);
}


/*
 * Keep track of which paths that have already been checked. No sense in
 * re-checking. This happens frequently for the default
 * font. If a locale has neither its own font directory, nor a directory
 * set up in locale_to_urls, it will fallback to default.
 */
var pathsChecked = {};

function checkFontPaths(fontPaths, done) {
  checkNextPath();

  function checkNextPath() {
    var path = fontPaths.shift();
    if (path && pathsChecked[path]) {
      // path has already been checked. NEXT!
      checkNextPath();
    } else if(path) {
      // path has not yet been checked, go see if it is a 200
      pathsChecked[path] = true;
      testRespondsWith(path, 200, function(err) {
        if (err) return done(err);
        checkNextPath();
      });
    }
    else {
      done(null);
    }
  }
}

function testRespondsWith(path, expectedCode, done) {
  wsapi.get(path, null, null, function(err, res) {
    if (err) return done(err);

    if (res.code !== expectedCode) {
      err = new Error(path + " expected " + expectedCode
          + " got " + res.code);
    }

    done(err);
  })();
}


/**
 * Search through the prod resources for /:locale/<fontName>/fonts.css links.
 */
function getFontCSSPaths() {
  var prodResources = getProdResources();

  var fontsInProdResource = _.map(prodResources, function(devResources) {
    var fontsInResource = _.filter(devResources, function(devResourceName) {
      return devResourceName.indexOf('/fonts.css') > -1;
    });

    return fontsInResource;
  });

  var fonts = _.reduce(fontsInProdResource, function(memo, fonts) {
    return memo.concat(fonts);
  }, []);

  /*
   * The same resouce can be included in both the dialog and main site,
   * only include each resource once.
   */
  return _.uniq(fonts);
}

function getProdResources() {
  // Get all of the languages.
  var localesPath = path.join(__dirname, "..", "config", "l10n-all.json");
  var localesData = fs.readFileSync(localesPath, 'utf8');
  var locales = JSON.parse(localesData).supported_languages;
  return resources.all(locales);
}

