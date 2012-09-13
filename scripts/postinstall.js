// make symlinks
var fs = require('fs');
var path = require('path');
var existsSync = fs.existsSync || path.existsSync;

// symlink'ed directories work fine in both *nix and Windows
function relativeLink(src, dest) {
  src = path.join(__dirname, src);
  dest = path.join(__dirname, dest);
  var destParent = path.dirname(dest);
  var cwd = process.cwd();
  process.chdir(destParent);

  if (existsSync(dest)) {
    fs.unlinkSync(dest);
  }
  var relSrc = path.relative(destParent, src);
  fs.symlinkSync(relSrc, dest, 'junction');
  process.chdir(cwd);
}

// Windows requires Administrator cmd prompt to make file links,
// so just make a copy instead.
function copy(src, dest) {
  src = path.join(__dirname, src);
  dest = path.join(__dirname, dest);
  fs.writeFileSync(dest, fs.readFileSync(src));
}

copy('../node_modules/jwcrypto/bidbundle.js', '../resources/static/common/js/lib/bidbundle.js');


// generate ephemeral keys
var child_process = require('child_process');
function node(script) {
  var cp = child_process.spawn('node', [path.join(__dirname, script)]);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
}

node('./generate_ephemeral_keys.js');
