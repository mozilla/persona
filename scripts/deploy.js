#!/usr/bin/env node

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

if (!process.env['ZERIGO_DNS_KEY'] && process.env['PERSONA_DEPLOY_DNS_KEY']) { 
  process.env['ZERIGO_DNS_KEY'] = process.env['PERSONA_DEPLOY_DNS_KEY'];
}

var cmd = path.join(__dirname, '..', 'node_modules', '.bin', 'awsbox');
cmd = path.relative(process.env['PWD'], cmd);

if (process.argv.length > 1 &&
    process.argv[2] === 'create' || 
    process.argv[2] === 'deploy')
{
  var options = {};

  if (process.argv.length > 3) options.n = process.argv[3];

  if (process.env['PERSONA_SSL_PRIV'] || process.env['PERSONA_SSL_PUB']) {
    options.p = process.env['PERSONA_SSL_PUB'];
    options.s = process.env['PERSONA_SSL_PRIV'];
  }

  if (process.env['ZERIGO_DNS_KEY']) {
    options.d = true;

    // when we have a DNS key, we can set a hostname!
    var scheme = (options.p ? 'https' : 'http') + '://';

    if (process.env['PERSONA_DEPLOYMENT_HOSTNAME']) {
      options.u = scheme + process.env['PERSONA_DEPLOYMENT_HOSTNAME'];
    } else if (options.n) {
      options.u = scheme + options.n + ".personatest.org";
    }

  } else {
    console.log('WARNING: No DNS key defined in the environment!  ' +
                'I cannot set up DNS for you.  We\'ll do this by IP.');
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
  cmd += " " + process.argv.slice(2).join(' ');
}

console.log("awsbox cmd: " + cmd);
var cp = child_process.exec(cmd, function(err) {
  if (err) process.exit(err.code);
  else process.exit(0);
});
cp.stdout.pipe(process.stdout);
cp.stderr.pipe(process.stderr);
