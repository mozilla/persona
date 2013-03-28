#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
fs = require('fs'),
path = require('path'),
mkdirp = require('mkdirp'),
logger = require('../lib/logging').logger,
version = require('../lib/version.js');

const BUILD_DIR_PATH = path.join(__dirname, "..", "resources", "static", "build");
const CODE_VERSION_JS_PATH = path.join(BUILD_DIR_PATH, "code_version.js");

/**
 * This module generates resources/static/build/code_version.js.
 * The code version is set to the version reported by version.js. The code
 * version is used by the front end, every time a WSAPI call is made the code
 * version is shipped along with it in the BrowserID-git-sha header. This
 * allows us to see if there are code version mismatches after a deployment.
 *
 * The basic flow:
 * 1) get the new version
 * 2) open code_version.js and read the already written version.
 * 3) if the new version is different than the already written version, update.
 *
 * A new code_version.js file is only written if the versions are different.
 * A needless update causes a re-compilation of all JS resources for all
 * enabled locales.
 */

var code_version;

/*
 * The interface. Expects a callback.
 * Callback will be called with (err, version)
 */
module.exports = function(done) {
  // Only one full check should be done per process.
  if (code_version) return done(null, code_version);

  // Only update code_version.js IFF the commit is different to the
  // version that is already written to disk. An unnecesary update to
  // curr_version.js forces a re-build of all locales during compress.
  version(function(commit) {
    fs.readFile(CODE_VERSION_JS_PATH, 'utf8', function(err, savedVersionJS) {
      // If the file does not exist, it will be written below.
      if (err && err.code !== "ENOENT") {
        // Something more serious is happening, uh oh.
        var msg = "Error reading " + CODE_VERSION_JS_PATH + ": " + String(err);
        logError(msg);
        return done(new Error(msg));
      }

      var newVersionJS = getCodeVersionJS(commit);
      if (savedVersionJS === newVersionJS) {
        console.info('code_version.js already up to date');
        return done(null, commit);
      }

      writeCodeVersionJS(commit, newVersionJS, done);
    });
  });
};

function logError(msg) {
  console.error(msg);
  logger.error(msg);
}

function getCodeVersionJS(commit) {
  return "BrowserID.CODE_VERSION = '" + commit + "';\n";
}

function writeCodeVersionJS(commit, contents, done) {
  console.info('code_version.js being written: ' + commit);

  try {
    // Make sure the build path is there or an exception is thrown when writing
    // to the output file.
    mkdirp.sync(BUILD_DIR_PATH);
  } catch(e) {
    return done(e);
  }

  fs.writeFile(CODE_VERSION_JS_PATH, contents, 'utf8', function (err) {
    if (err) {
      var msg = "Error writing " + CODE_VERSION_JS_PATH + ": " + String(err);
      logError(msg);
      return done(new Error(msg));
    }

    // save a copy of the code_version to prevent the entire process only
    // happens once per process.
    code_version = commit;
    done(null, commit);
  });
}

