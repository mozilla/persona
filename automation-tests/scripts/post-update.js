#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const child_process = require("child_process"),
      util          = require('util'),
      fs            = require("fs"),
      path          = require("path");

function extend() {
  var extended = {};
  var extensions = Array.prototype.slice.call(arguments, 0);
  extensions.forEach(function(extension) {
    for (var key in extension) {
      if (typeof extension[key] !== "undefined") {
        extended[key] = extension[key];
      }
    }
  });

  return extended;
}

function installDependencies(done) {
  util.log(">> Installing selenium test dependencies");

  var installProcess = child_process.spawn("npm", ["install"], {
    cwd: path.join(__dirname, ".."),
    env: process.env
  });

  installProcess.stdout.pipe(process.stdout);
  installProcess.stderr.pipe(process.stderr);

  installProcess.on('exit', done);
}

function getTestEnvironment() {
  var sauceConfigPath = path.join(__dirname, "..", "..", "..", "sauce.json");
  var sauceConfig = JSON.parse(fs.readFileSync(sauceConfigPath, 'utf8'));

  var globalConfigPath = path.join(__dirname, "..", "..", "..", "config.json");
  var globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));

  // get the name of the instance.
  var personaEnv = globalConfig.public_url.replace("https://", '').replace(".personatest.org", "");
  var env = extend(process.env, {
    RUNNERS: sauceConfig.runners,
    PERSONA_ENV: personaEnv,
    PERSONA_SAUCE_USER: sauceConfig.persona_sauce_user,
    PERSONA_SAUCE_APIKEY: sauceConfig.persona_sauce_api_key,
    PERSONA_SAUCE_PASS: sauceConfig.persona_sauce_pass,
    PERSONA_BROWSER: sauceConfig.persona_browser
  });

  return env;
}

function runTests(done) {
  var env = getTestEnvironment();
  util.log(">> Running tests against " + env.PERSONA_ENV);

  var runnerPath = path.join(__dirname, "run-all.js");
  var testProcess = child_process.spawn("node", [ runnerPath ], {
    env: env
  });

  testProcess.stdout.pipe(process.stdout);
  testProcess.stderr.pipe(process.stderr);

  testProcess.on('exit', function(code) {
    console.log("done", code);
    done && done();
  });
}

installDependencies(function() {
  runTests(function(code) {
    process.exit(code);
  });
});


