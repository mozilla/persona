#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/*
 * This takes care of updating sauce config and starting tests on the remote
 * server.
 */

const child_process = require('child_process'),
      util          = require('util');

var host = "tester.personatest.org",
    user = 'app@' + host,
    target = user + ':sauce.json';


function startTests(done) {
  startProcess('ssh', [
    user,
    'node',
    'code/automation-tests/scripts/post-update.js'
  ], function(code) {
    var error = null;

    if (code) error = new Error("test run failure on " + host);

    done(error, code);
  });
}


function startProcess(cmd_name, args, done) {
  var childProcess = child_process.spawn(cmd_name, args);

  childProcess.stdout.on('data', function(data) {
    util.print(data.toString());
  });

  childProcess.stderr.on('data', function(data) {
    util.error(data.toString());
  });

  childProcess.on('exit', done);

  return childProcess;
}

startTests(function(err, info) {
if (err) throw err;

process.exit(0);
});

