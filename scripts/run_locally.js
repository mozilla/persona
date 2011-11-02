#!/usr/bin/env node

const
spawn = require('child_process').spawn,
path = require('path');

exports.daemons = daemons = {};

const HOST = process.env['IP_ADDRESS'] || process.env['HOST'] || "127.0.0.1";

var daemonsToRun = {
  verifier: {
    PORT: 10000,
    HOST: HOST
  },
  keysigner: {
    PORT: 10003,
    HOST: HOST
  },
  example: {
    path: path.join(__dirname, "..", "scripts", "serve_example.js"),
    PORT: 10001,
    HOST: HOST
  },
  browserid: {
    PORT: 10002,
    HOST: HOST
  }
};

// all spawned processes should log to console
process.env['LOG_TO_CONSOLE'] = 1;

// all spawned processes will communicate with the local browserid
process.env['BROWSERID_URL'] = 'http://' + HOST + ":10002";
process.env['VERIFIER_URL'] = 'http://' + HOST + ":10000/verify";
process.env['KEYSIGNER_URL'] = 'http://' + HOST + ":10003";

Object.keys(daemonsToRun).forEach(function(k) {
  Object.keys(daemonsToRun[k]).forEach(function(ek) {
    process.env[ek] = daemonsToRun[k][ek];
  });
  var pathToScript = daemonsToRun[k].path || path.join(__dirname, "..", "bin", k);
  var p = spawn('node', [ pathToScript ]);

  function dump(d) {
    d.toString().split('\n').forEach(function(d) {
      if (d.length === 0) return;
      console.log(k, '(' + p.pid + '):', d);
    });
  }

  p.stdout.on('data', dump);
  p.stderr.on('data', dump);

  console.log("spawned", k, "("+pathToScript+") with pid", p.pid);
  Object.keys(daemonsToRun[k]).forEach(function(ek) {
    delete process.env[ek];
  });

  daemons[k] = p;

  p.on('exit', function (code, signal) {
    console.log(k, 'exited with code', code, (signal ? 'on signal ' + signal : ""));
    delete daemons[k];
    Object.keys(daemons).forEach(function (k) { daemons[k].kill(); });
    if (Object.keys(daemons).length === 0) {
      console.log("all daemons torn down, exiting...");
    }
  });
});

process.on('SIGINT', function () {
  console.log('\nSIGINT recieved! trying to shut down gracefully...');
  Object.keys(daemons).forEach(function (k) { daemons[k].kill('SIGINT'); });
});
