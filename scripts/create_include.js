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
    var winchan_dir = path.join(__dirname, '..', 'resources', 'static', 'common', 'js', 'lib');

    var output_dir = process.env.BUILD_DIR ||
                  path.join(__dirname, '..', 'resources', 'static', 'build');

    // make sure the output directory is there before continuing.
    mkdirp.sync(output_dir);
    var target = path.join(output_dir, 'include.js');

    var output = "";
    output += fs.readFileSync(path.join(dir, '_header.js'));
    output += '\n(function() {\n';
    // define undefined in case the RP has accidentally redefined undefined.
    output += '\tvar undefined;\n';
    output += fs.readFileSync(path.join(dir, '_jschannel.js'));
    output += fs.readFileSync(path.join(winchan_dir, 'winchan.js'));
    output += fs.readFileSync(path.join(dir, '_include.js'));
    output += '}());\n';

    fs.writeFileSync(target, output);
  } catch(e) {
    console.error(String(e));
    done && done(e);
  }
};

// If calling this from the command line, run the script immediately.
if (process.argv[1] === __filename) module.exports();

