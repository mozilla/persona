/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var child_process = require('child_process'),
    util          = require('util');

exports.scp = function(path, target, done) {
  var scpProcess = child_process.spawn("scp", [
    /*
    '-o',
    '"StrictHostKeyChecking no"',
    'no"',
    */
    path,
    target
  ]);

  scpProcess.stdout.on('data', function(data) {
    util.print(data.toString());
  });

  scpProcess.stderr.on('data', function(data) {
    util.error(data.toString());
  });

  scpProcess.on('exit', function(code) {
    var error = null;

    if (!code) {
      console.log(">> Successful copy of " + path + " to " + target);
    }
    else {
      error = new Error("Could not copy " + path + " to " + target);
    }

    done(error, code);
  });
};
