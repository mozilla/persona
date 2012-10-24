/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// determine the software 'version'.  This is the 7 char abbrevieated SHA
// we try to read this from ver.txt at the top level, then try to use git,
// then finally fall back to a randomly generated 7 char string
// this version will be used for features like cache busting

const
fs = require('fs'),
path = require('path'),
logger = require('./logging.js').logger,
spawn = require('child_process').spawn,
secrets = require('./secrets.js'),
config = require('./configuration');

var sha;

// first try ver.txt which by convention is placed in repo root at
// deployment time
if (config.get('env') === 'production') {
  try {
    var contents = fs.readFileSync(path.join(__dirname, '..', 'resources', 'static', 'ver.txt'));
    sha = contents.toString().split(' ')[0];
    if (sha.length !== 7) throw "bad sha in ver.txt";
  } catch(e) {
    sha = undefined;
    logger.debug('cannot read code version from ver.txt: ' + e);
  }
}

// now set the SHA to either the read SHA or a random string
module.exports = function() { return sha; };

// if ver.txt discovery failed, try using git to get the sha.
if (!sha) {
  sha = secrets.weakGenerate(7);

  // next try using git
  var p = spawn('git', [ 'log', '--pretty=%h', '-1' ]);
  var buf = "";
  p.stdout.on('data', function(d) {
    buf += d;
  });
  p.stdout.on('end', function() {
    var gitsha = buf.toString().trim();
    if (gitsha && gitsha.length === 7) {
      sha = gitsha;
      logger.info('code version (via git) is: ' + module.exports());
    } else {
      logger.warn('code version (randomly generated) is: ' + module.exports());
    }
  });
} else {
  logger.info('code version (from ver.txt) is: ' + module.exports());
}
