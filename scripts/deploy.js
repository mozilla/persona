#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var path = require('path'),
child_process = require('child_process');

/*
 * A thin wrapper around awsbox that expects certain env
 * vars and invokes awsbox for ya to deploy a VM.
 */

if (!process.env['AWS_ID'] || ! process.env['AWS_SECRET']) {
  console.log("You haven't defined AWS_ID and AWS_SECRET in the environment");
  console.log("Get these values from the amazon web console and try again.");
  process.exit(1);
}

var cmd = path.join(__dirname, '..', 'node_modules', '.bin', 'awsbox');
cmd = path.relative(process.env['PWD'], cmd);

if (['create', 'deploy'].indexOf(process.argv[2]) !== -1) {
  var options = {};

  if (process.argv.length > 3) options.n = process.argv[3];

  if (process.env['PERSONA_SSL_PRIV'] || process.env['PERSONA_SSL_PUB']) {
    options.p = process.env['PERSONA_SSL_PUB'];
    options.s = process.env['PERSONA_SSL_PRIV'];
  }

  // DNS is done with Route53, so if you have AWS keys, you get DNS (assuming
  // your Route53 is authoritative for the domain you choose).
  options.d = true;

  var scheme = (options.p ? 'https' : 'http') + '://';

  if (process.env['PERSONA_DEPLOYMENT_HOSTNAME']) {
    options.u = scheme + process.env['PERSONA_DEPLOYMENT_HOSTNAME'];
  } else if (options.n) {
    var domain = process.env['PERSONA_DEPLOYMENT_DOMAIN'] || ".personatest.org";
    options.u = scheme + options.n + domain;
  }

  // pass through/override with user provided vars
  for (var i = 3; i < process.argv.length; i++) {
    var k = process.argv[i];
    if (i + 1 < process.argv.length && k.length === 2 && k[0] === '-') {
      options[k[1]] = process.argv[++i];
    }
  }

  if (process.env['PERSONA_EPHEMERAL_CONFIG']) {
    options.x = process.env['PERSONA_EPHEMERAL_CONFIG'];
  }

  cmd += " create --ssl=force";

  Object.keys(options).forEach(function(opt) {
    cmd += " -" + opt;
    cmd += typeof options[opt] === 'string' ? " " + options[opt] : "";
  });
} else {
  // Otherwise, pass through args to awsbox
  cmd += " " + process.argv.slice(2).join(' ');
}

console.log("awsbox cmd: " + cmd);
var cp = child_process.exec(cmd, function(err) {
  if (err) process.exit(err.code);
  else process.exit(0);
});
cp.stdout.pipe(process.stdout);
cp.stderr.pipe(process.stderr);
