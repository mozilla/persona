#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs        = require('fs'),
      path      = require('path'),
      mkdirp    = require('mkdirp');


/*
 * Generates a static include.js file.
 * Automatically called during compress and run_locally.js.
 */

module.exports = function(done) {
  try {
    var dir = path.join(__dirname, '..', 'resources', 'static', 'include_js');

    var output_dir = process.env.BUILD_DIR ||
                  path.join(__dirname, '..', 'resources', 'static', 'build');

    // make sure the output directory is there before continuing.
    mkdirp.sync(output_dir);
    var target = path.join(output_dir, 'include.js');

    fs.writeFileSync(target, fs.readFileSync(path.join(dir, '_header.js')));
    fs.appendFileSync(target, '\n(function() {\n');
    fs.appendFileSync(target, fs.readFileSync(path.join(dir, '_jschannel.js')));
    fs.appendFileSync(target, fs.readFileSync(path.join(dir, '_winchan.js')));
    fs.appendFileSync(target, fs.readFileSync(path.join(dir, '_include.js')));
    fs.appendFileSync(target, '}());\n');
  } catch(e) {
    console.error(String(e));
    done && done(e);
  }
};

// If calling this from the command line, run the script immediately.
if (process.argv[1] === __filename) module.exports();

