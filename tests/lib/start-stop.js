/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const
assert = require('assert'),
fs = require('fs'),
path = require('path'),
wsapi = require('./wsapi.js'),
spawn = require('child_process').spawn,
events = require('events'),
config = require('configuration'),
db = require('db');

var proc = undefined;

process.on('exit', function () {
  if (proc) { proc.kill(); }
});

exports.browserid = new events.EventEmitter;

function setupProc(proc) {
  var m, sentReady = false;

  proc.stdout.on('data', function(x) {
    if (process.env['LOG_TO_CONSOLE']) console.log(x.toString());
    var tokenRegex = new RegExp('token=([A-Za-z0-9]+)$', 'm');

    if (!sentReady && /^browserid.*127\.0\.0\.1:10002/.test(x)) {
      exports.browserid.emit('ready');
      sentReady = true;
    } else if (m = tokenRegex.exec(x)) {
      exports.browserid.emit('token', m[1]);
    }
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
        if (config.get('database').driver === 'mysql') {
          process.env['MYSQL_DATABASE_NAME'] = config.get('database').database;
        } else if (config.get('database').driver === 'json') {
          process.env['JSON_DATABASE_PATH'] = config.get('database').path;
        }
        return true;
      },
      "should work": function(x) {
        var cfg = process.env['MYSQL_DATABASE_NAME'] || process.env['JSON_DATABASE_PATH'];
        assert.equal(typeof cfg, 'string');
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
        assert.isUndefined(r);
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
        "server is running": function (r, err) {
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
        "server is running": function (r, err) {
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
    "closing the database": {
      topic: function() {
        db.close(this.callback);
      },
      "should work": function(err) {
        assert.isUndefined(err);
      }
    }
  });
}

