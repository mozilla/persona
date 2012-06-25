/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
assert = require('assert'),
fs = require('fs'),
path = require('path'),
wsapi = require('./wsapi.js'),
spawn = require('child_process').spawn,
events = require('events'),
config = require('../../lib/configuration.js'),
db = require('../../lib/db.js');

var proc = undefined;

process.on('exit', function () {
  if (proc) { proc.kill(); }
});

var nextTokenFunction = undefined;
var tokenStack = [];

exports.waitForToken = function(cb) {
  if (tokenStack.length) {
    var t = tokenStack.shift();
    process.nextTick(function() { cb(t); });
  }
  else {
    if (nextTokenFunction) throw "can't wait for a verification token when someone else is!";
    nextTokenFunction = cb;
  }
};

exports.browserid = new events.EventEmitter;

function setupProc(proc) {
  var m, sentReady = false;

  proc.stdout.on('data', function(buf) {
    buf.toString().split('\n').forEach(function(x) {
      if (process.env['LOG_TO_CONSOLE'] || /^.*error.*:/.test(x)) {
        var line = x.toString().trim();
        if (line.length) {
          console.log(line);
        }
      }
      var tokenRegex = new RegExp('token=([A-Za-z0-9]+)$', 'm');
      var pidRegex = new RegExp('^spawned (\\w+) \\(.*\\) with pid ([0-9]+)$');

      if (!sentReady && /^router.*127\.0\.0\.1:10002$/.test(x)) {
        exports.browserid.emit('ready');
        sentReady = true;
      } else if (!sentReady && (m = pidRegex.exec(x))) {
        process.env[m[1].toUpperCase() + "_PID"] = m[2]; 
      } else if (m = tokenRegex.exec(x)) {
        if (!(/forwarding request:/.test(x))) {
          tokenStack.push(m[1]);
          if (nextTokenFunction) {
            nextTokenFunction(tokenStack.shift());
            nextTokenFunction = undefined;
          }
        }
      }
    });
  });
  proc.stderr.on('data', function(x) {
    if (process.env['LOG_TO_CONSOLE']) console.log(x.toString());
  });
}

function removeVarDir() {
  try {
    fs.readdirSync(varPath).forEach(function(f) {
        fs.unlinkSync(path.join(varPath, f));
    });
    fs.rmdirSync(varPath);
  } catch(e) {}
}

exports.addStartupBatches = function(suite) {

  // disable vows (often flakey?) async error behavior
  suite.options.error = false;

  // propogate our ephemeral database parameters down to
  // child processes so that all process are communicating
  // with the same db
  suite.addBatch({
    "specifying an ephemeral database": {
      topic: function() {
        config.set("database.name", process.env['DATABASE_NAME']);
        return true;
      },
      "should work": function(x) {
        assert.equal(typeof config.get('database.name'), 'string');
        assert.equal(typeof process.env['DATABASE_NAME'], 'string');
        assert.equal(process.env['DATABASE_NAME'], config.get('database.name'));
      }
    }
  });

  suite.addBatch({
    "opening the database": {
      topic: function() {
        var cfg = config.get('database');
        cfg.drop_on_close = true;
        db.open(cfg, this.callback);
      },
      "should work fine": function(r) {
        assert.isNull(r);
      }
    }
  });

  suite.addBatch({
    "run the server": {
      topic: function() {
        var pathToHarness = path.join(__dirname, '..', '..', 'scripts', 'run_locally.js');
        proc = spawn('node', [ pathToHarness ])
        setupProc(proc);
        exports.browserid.on('ready', this.callback);
      },
      "server should be running": {
        topic: wsapi.get('/__heartbeat__'),
        "server is running": function (err, r) {
          assert.equal(r.code, 200);
          assert.equal(r.body, 'ok');
        }
      }
    }
  });
};

exports.addRestartBatch = function(suite) {
  // stop the server
  suite.addBatch({
    "stop the server": {
      topic: function() {
        var cb = this.callback;
        proc.kill('SIGINT');
        proc.on('exit', this.callback);
      },
      "stopped": function(x) {
        assert.strictEqual(x, 0);
      }
    }
  });

  suite.addBatch({
    "run the server": {
      topic: function() {
        var pathToHarness = path.join(__dirname, '..', '..', 'scripts', 'run_locally.js');
        proc = spawn('node', [ pathToHarness ])
        setupProc(proc);
        exports.browserid.on('ready', this.callback);
      },
      "server should be running": {
        topic: wsapi.get('/__heartbeat__'),
        "server is running": function (err, r) {
          assert.equal(r.code, 200);
          assert.equal(r.body, 'ok');
        }
      }
    }
  });

};

exports.addShutdownBatches = function(suite) {
  // stop the server
  suite.addBatch({
    "stop the server": {
      topic: function() {
        var cb = this.callback;
        proc.kill('SIGINT');
        proc.on('exit', this.callback);
      },
      "stopped": function(x) {
        assert.strictEqual(x, 0);
      }
    }
  });

  // clean up
  suite.addBatch({
    "closing (and removing) the database": {
      topic: function() {
        db.closeAndRemove(this.callback);
      },
      "should work": function(err) {
        assert.isNull(err);
      }
    }
  });
}
