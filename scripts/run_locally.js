#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const path = require('path'),
spawn = require('child_process').spawn,
config = require('../lib/configuration.js'),
temp = require('temp'),
secrets = require('../lib/secrets.js');

var daemons = exports.daemons = {};

const HOST = process.env['IP_ADDRESS'] || process.env['HOST'] || "127.0.0.1";

var daemonsToRun = {
  verifier: { },
  keysigner: { },
  dbwriter: { },
  example: {
    path: path.join(__dirname, "..", "scripts", "serve_example.js"),
    PORT: 10001,
    HOST: HOST
  },
  example_primary: {
    SHIMMED_DOMAIN: "example.domain",
    path: path.join(__dirname, "..", "scripts", "serve_example_primary.js"),
    PORT: 10005,
    HOST: HOST
  },
  example_delegated_primary: {
    SHIMMED_DOMAIN: "delegated.domain",
    path: path.join(__dirname, "..", "scripts", "serve_example_delegated_primary.js"),
    PORT: 10011,
    HOST: HOST
  },
  proxy: { },
  browserid: { },
  static: { },
  router: { }
};

// route outbound HTTP through our in-tree proxy to always test said codepath
process.env['HTTP_PROXY'] = HOST + ":10006";

process.env['HOST'] = HOST;

// use the "local" configuration
var configFiles = [];
if (process.env['CONFIG_FILES']) {
  var configFiles = process.env['CONFIG_FILES'].split(',');
}
configFiles.push(path.join(__dirname, '..', 'config', 'local.json'));
process.env['CONFIG_FILES'] = configFiles.join(',');

// all spawned process that use handle primaries should know about "shimmed"
// primaries
var oldShims = process.env['SHIMMED_PRIMARIES'] ? process.env['SHIMMED_PRIMARIES'] + "," : "";
process.env['SHIMMED_PRIMARIES'] = oldShims +
  "example.domain|http://" + HOST + ":10005|" + 
  path.join(__dirname, "..", "example", "primary", ".well-known", "browserid") +
  "," + "delegated.domain|http://" + HOST + ":10011|" +
  path.join(__dirname, "..", "example", "delegated_primary", ".well-known", "browserid") +
  "," + "bigtent.domain|http://bigtent.domain:10012|" +
  path.join(__dirname, "..", "example", "bigtent", ".well-known", "browserid");

// all spawned processes should log to console
process.env['LOG_TO_CONSOLE'] = 1;

// all spawned processes will communicate with the local browserid
process.env['DBWRITER_URL'] = 'http://' + HOST + ":10004";
process.env['BROWSERID_URL'] = 'http://' + HOST + ":10007";
process.env['VERIFIER_URL'] = 'http://' + HOST + ":10000/verify";
process.env['KEYSIGNER_URL'] = 'http://' + HOST + ":10003";
process.env['ROUTER_URL'] = 'http://' + HOST + ":10002";
process.env['STATIC_URL'] = 'http://' + HOST + ":10010";

process.env['PUBLIC_URL'] = process.env['ROUTER_URL'];

// if the environment is a 'test_' environment, then we'll use an
// ephemeral database
if (config.get('env').substr(0,5) === 'test_') {
  if (config.get('database').driver === 'mysql') {
    process.env['DATABASE_NAME'] =
      process.env['DATABASE_NAME'] || "browserid_tmp_" + secrets.generate(6);
    console.log("temp mysql database:", process.env['DATABASE_NAME']);
  } else if (config.get('database').driver === 'json') {
    process.env['DATABASE_NAME'] =  process.env['DATABASE_NAME'] || temp.path({suffix: '.db'});
    console.log("temp json database:", process.env['DATABASE_NAME']);
  }
}

// Windows can't use signals, so lets figure out if we should use them
// To force signals, set the environment variable SUPPORTS_SIGNALS=true.
// Otherwise, they will be feature-detected.
var SIGNALS_PROP = 'SUPPORTS_SIGNALS';
if (!(SIGNALS_PROP in process.env)) {
  try {
    function signals_test() {}
    process.on('SIGINT', signals_test);
    process.removeListener('SIGINT', signals_test);
    process.env[SIGNALS_PROP] = true;
  } catch (noSignals) {
    // process.env converts all values set into strings, so setting this to
    // false would get converted to the string false.  Better to set nothing.
  }
}

var debugPort = 5859;
var inspectorProc;

function runDaemon(daemon, cb) {
  Object.keys(daemonsToRun[daemon]).forEach(function(ek) {
    if (ek === 'path') return; // this blows away the Window PATH
    process.env[ek] = daemonsToRun[daemon][ek];
  });

  var pathToScript = daemonsToRun[daemon].path || path.join(__dirname, "..", "bin", daemon);
  var args = [ pathToScript ];

  if (process.env.PERSONA_DEBUG_MODE) {
    args.unshift('--debug=' + debugPort++);
  } else if (process.env.PERSONA_WITH_COVER) {
    var pathToCover = path.join(__dirname, "..", "node_modules", ".bin", "cover");
    if (path.existsSync(pathToCover)) {
      args.unshift(pathToCover, 'run');
    }
  }

  var p = spawn('node', args);

  function dump(d) {
    d.toString().split('\n').forEach(function(d) {
      if (d.length === 0) return;
      console.log(daemon, '(' + p.pid + '):', d);

      // when we find a line that looks like 'running on <url>' then we've
      // fully started up and can run the next daemon.  see issue #556
      if (cb && /^.*running on http:\/\/.*:[0-9]+$/.test(d)) {
        cb();
        cb = undefined;
      }
    });
  }

  p.stdout.on('data', dump);
  p.stderr.on('data', dump);

  console.log("spawned", daemon, "("+pathToScript+") with pid", p.pid);
  Object.keys(daemonsToRun[daemon]).forEach(function(ek) {
    if (ek === 'path') return; // don't kill the Windows PATH
    delete process.env[ek];
  });

  daemons[daemon] = p;

  p.on('exit', function (code, signal) {
    console.log(daemon, 'exited(' + code + ') ', (signal ? 'on signal ' + signal : ""));
    delete daemons[daemon];
    Object.keys(daemons).forEach(function (daemon) { daemons[daemon].kill(); });
    if (Object.keys(daemons).length === 0) {
      if (process.env.PERSONA_DEBUG_MODE) inspectorProc.kill();
      console.log("all daemons torn down, exiting...");
    }
  });
}

// start all daemons except the router in parallel
var daemonNames = Object.keys(daemonsToRun);
daemonNames.splice(daemonNames.indexOf('router'), 1);

var numDaemonsRun = 0;
daemonNames.forEach(function(dn) {
  runDaemon(dn, function() {
    if (++numDaemonsRun === daemonNames.length) {
      // after all daemons are up and running, start the router
      runDaemon('router', function() {
        if (process.env.PERSONA_DEBUG_MODE) {
          var inspectPath = path.join(__dirname, "..", "node_modules", ".bin", "node-inspector");
          inspectorProc = spawn(inspectPath, []);
        }
      });
    }
  });
});

if (process.env[SIGNALS_PROP]) {
  process.on('SIGINT', function () {
    console.log('\nSIGINT recieved! trying to shut down gracefully...');
    Object.keys(daemons).forEach(function (k) { daemons[k].kill('SIGINT'); });
  });

}
