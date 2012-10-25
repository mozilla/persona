#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/*
 * This takes care of updating sauce config and starting tests on the remote
 * server.
 */

const fs            = require('fs'),
      child_process = require('child_process'),
      util          = require('util'),
      temp          = require('temp'),
      scp           = require('./scp').scp;

var host = "tester.personatest.org",
    user = 'app@' + host,
    target = user + ':sauce.json';


function getFromEnv(name) {
  var envValue = process.env[name];
  if (typeof envValue === "undefined")
    throw new Error(name + " must be defined as an environment variable");

  return envValue;
}

function copyConfig(done) {

  temp.open({}, function(err, temp_file) {
    var config = {
      persona_sauce_user: getFromEnv("PERSONA_SAUCE_USER"),
      persona_sauce_api_key: getFromEnv("PERSONA_SAUCE_APIKEY"),
      persona_sauce_pass: getFromEnv("PERSONA_SAUCE_PASS"),
      runners: 10
    };

    fs.writeFileSync(temp_file.path, JSON.stringify(config), 'utf8');

    scp(temp_file.path, target, done);
  });
}

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

copyConfig(function(err, code) {
  if (err) throw err;

  startTests(function(err, info) {
    if (err) throw err;

    process.exit(0);
  });
});

