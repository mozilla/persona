#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs            = require('fs'),
      temp          = require('temp'),
      scp           = require('./scp').scp;

function getFromEnv(name, defaultValue) {
  var envValue = process.env[name];
  if (typeof defaultValue === "undefined" && typeof envValue === "undefined")
    throw new Error(name + " must be defined as an environment variable");

  return typeof envValue === "undefined" ? defaultValue : envValue;
}

var host = getFromEnv('AWS_IP_ADDRESS'),
    user = 'app@' + host,
    target = user + ':sauce.json';


function copyConfig(done) {
  temp.open({}, function(err, temp_file) {
    if (err) throw err;

    var config = {
      persona_sauce_user: getFromEnv("PERSONA_SAUCE_USER"),
      persona_sauce_api_key: getFromEnv("PERSONA_SAUCE_APIKEY"),
      persona_sauce_pass: getFromEnv("PERSONA_SAUCE_PASS"),
      persona_browser: getFromEnv("PERSONA_BROWSER", "vista_chrome"),
      runners: parseInt(getFromEnv("RUNNERS", 30), 10)
    };

    fs.writeFileSync(temp_file.path, JSON.stringify(config), 'utf8');

    console.log("    >> Copying sauce credentials to instance");
    scp(temp_file.path, target, done);
  });
}

copyConfig(function(err, status) {
  if (err) throw err;

  process.exit(status);
});

