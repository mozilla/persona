"use strict";
// make symlinks
var fs = require('fs');
var path = require('path');

// Windows requires Administrator cmd prompt to make file links,
// so just make a copy instead.
function copy(src, dest) {
  src = path.join(__dirname, src);
  dest = path.join(__dirname, dest);
  fs.writeFileSync(dest, fs.readFileSync(src));
}

copy('../node_modules/jwcrypto/bidbundle.js', '../resources/static/common/js/lib/bidbundle.js');
copy('../node_modules/gobbledygook/gobbledygook.js', '../resources/static/common/js/lib/gobbledygook.js');


// generate ephemeral keys
var child_process = require('child_process');
function node(script) {
  var cp = child_process.spawn('node', [path.join(__dirname, script)]);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
}

node('./generate_ephemeral_keys.js');

// To install the automation-tests dependencies, specify AUTOMATION_TESTS=true
// on the command line when running npm install. See issue  #3160
if (process.env.AUTOMATION_TESTS) {
  console.log(">>> Installing automation-tests dependencies");
  // install automation-test dependencies
  var npm_process = child_process.spawn('npm', ['install'], {
    cwd: path.join(__dirname, '..', 'automation-tests'),
    env: process.env
  });
  npm_process.stdout.pipe(process.stdout);
  npm_process.stderr.pipe(process.stderr);
}
