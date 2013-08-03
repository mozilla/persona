#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const child_process = require("child_process"),
      fs            = require("fs"),
      path          = require("path"),
      toolbelt      = require("../lib/toolbelt");

function installDependencies(done) {
  console.log(">> Installing selenium test dependencies");

  var installProcess = child_process.spawn("npm", ["install"], {
    cwd: path.join(__dirname, ".."),
    env: process.env
  });

  installProcess.stdout.pipe(process.stdout);
  installProcess.stderr.pipe(process.stderr);
  installProcess.on('exit', done);
}

function getJSONConfig(name) {
  var config;
  try {
    var configPath = path.join(__dirname, "..", "..", "..", name);
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch(e) {
    console.error("cannot read " + name + " or json is invalid");
    process.exit(1);
  }

  return config;
}

function getTestEnvironment() {
  // the next two will exit the process if they fail.
  var sauceConfig = getJSONConfig("sauce.json"),
      globalConfig = getJSONConfig("config.json"),
      // personaEnv is the name of the ephemeral instance
      personaEnv = globalConfig.public_url.replace("https://", '').replace(".personatest.org", "");

  var env = toolbelt.copyExtendEnv({
    RUNNERS: sauceConfig.runners,
    PERSONA_ENV: personaEnv,
    PERSONA_SAUCE_USER: sauceConfig.persona_sauce_user,
    PERSONA_SAUCE_APIKEY: sauceConfig.persona_sauce_api_key,
    PERSONA_SAUCE_PASS: sauceConfig.persona_sauce_pass,
    PERSONA_BROWSER: sauceConfig.persona_browser
  });

  return env;
}

function runTests(env, done) {
  console.log(">> Running tests against " + env.PERSONA_ENV);

  var runnerPath = path.join(__dirname, "run-all.js");
  var testProcess = child_process.spawn("node", [ runnerPath ], {
    env: env
  });

  testProcess.stdout.pipe(process.stdout);
  testProcess.stderr.pipe(process.stderr);
  testProcess.on('exit', done);
}

var env = getTestEnvironment();
installDependencies(function() {
  runTests(env, function(code) {
    console.log(">> Exiting tests with code: " + code);
    process.exit(code);
  });
});


