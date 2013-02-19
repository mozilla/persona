#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This script takes care of compiling locale specific json files.
 *
 * Process used:
 * 1) checkout or update browserid locale repo under ~root/locale directory
 * 2) compile .po files into .json files located at
 *        ~root/resources/static/i18n
 */


const mkdirp         = require('mkdirp'),
      fs             = require('fs'),
      path           = require('path'),
      child_process  = require('child_process');

const existsSync = fs.existsSync || path.existsSync;

const svnRepo =
        'https://svn.mozilla.org/projects/l10n-misc/trunk/browserid/locale/';

// where locale svn repo is located.
const localePath = path.join(__dirname, '..', 'locale');

// where compile script is located.
const compileScriptPath = path.join(localePath, 'compile-json.sh');

// where to place the json files.
const jsonOutputPath = path.join(__dirname, '..', 'resources', 'static', 'i18n');

var spawn = function(command, args, opts, done) {
  var cp = child_process.spawn(command, args, opts);

  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);

  cp.on('exit', function(code) {
    if (code) return quit(code);
    done && done(code);
  });

  return cp;
};

var logStage = function(msg) {
  console.log("=>", msg);
}

if (!existsSync(localePath)) {
  logStage("checking out svn repo");
  mkdirp.sync(localePath);
  spawn('svn', ['co', svnRepo, localePath], null, compileJSON);
}
else {
  logStage("updating svn repo");
  spawn('svn', ['up'], { cwd: localePath }, compileJSON);
}

function compileJSON() {
  if (!existsSync(jsonOutputPath)) {
    mkdirp.sync(jsonOutputPath);
  }

  logStage("compiling json files");
  spawn(compileScriptPath, [localePath, jsonOutputPath], null, quit);
}

function quit(code) {
  console.log("exiting with code: ", code);
  process.exit(code);
}

