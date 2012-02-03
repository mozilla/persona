#!/usr/bin/env node

const
temp = require('temp'),
path = require('path'),
util = require('util'),
events = require('events'),
git = require('./deploy/git.js'),
https = require('https');

// a class capable of deploying and emmitting events along the way
function Deployer() {
  events.EventEmitter.call(this);

  // a directory where we'll keep code
  this._codeDir = '/tmp/fuck'; // temp.mkdirSync();
  console.log("code dir is:", this._codeDir);
  var self = this;

/*
  git.init(this._codeDir, function(err) {
    if (err) {
      console.log("can't init code dir:", err);
      process.exit(1);
    }
    self.emit('ready');
  });
*/
  // a directory where we'll deployment logs
  this._deployLogDir = temp.mkdirSync();
  console.log("deployment log dir is:", this._deployLogDir);
  
  process.nextTick(function() {
    self.emit('ready');
  });
}

util.inherits(Deployer, events.EventEmitter);

Deployer.prototype._getLatestRunningSHA = function(cb) {
  // failure is not fatal.  maybe nothing is running?
  function fail(err) {
    self.emit('info', { msg: "can't get current running sha", reason: err });
    cb(null, null);
  }

  var self = this;
  https.get({ host: 'dev.diresworb.org', path: '/ver.txt' }, function(res) {
    var buf = ""; 
    res.on('data', function (c) { buf += c });
    res.on('end', function() {
      try {
        var sha = buf.split(' ')[0];
        if (sha.length == 7) {
          self.emit('info', 'latest running is ' + sha);
          return cb(null, sha);
        }
        fail('malformed ver.txt: ' + buf);
      } catch(e) {
        fail(e);
      }
    });
  }).on('error', function(err) {
    fail(err);
  });

}

Deployer.prototype._cleanupOldVMs = function() {
  this.emit('error', "not yet implemented");
}

Deployer.prototype._deployNewCode = function(cb) {
  function splitAndEmit(chunk) {
    if (chunk) chunk = chunk.toString();
    if (typeof chunk === 'string') {
      chunk.split('\n').forEach(function (line) {
        line = line.trim();
        if (line.length) self.emit('progress', line);
      });
    }
  }

  var p = spawn('scripts/deploy_dev.js', { cwd: self._codeDir });
  
  p.stdout.on('data', splitAndEmit);
  p.stderr.on('data', splitAndEmit);

  p.on('exit', function(code, signal) {
    return cb(code = 0);
  });
};

Deployer.prototype._pullLatest = function(cb) {
  var self = this;
  git.pull(this._codeDir, 'git@github.com:mozilla/browserid', 'dev', function(l) {
    self.emit(l);
  }, function(err) {
    if (err) return self.emit('error', err);
    git.currentSHA(self._codeDir, function(err, latest) {
      if (err) return self.emit('error', err);
      self.emit('info', 'latest available sha is ' + latest);
      self._getLatestRunningSHA(function(err, running) {
        if (latest != running) {
          self.emit('deployment_begins', {
            sha: latest,
          });
          var startTime = new Date();

          self._deployNewCode(function(err, res) {
            if (err) return self.emit('error', err);
            // deployment is complete!
            self.emit('deployment_complete', {
              sha: latest,
              time: (startTime - new Date())
            });
            // finally, let's clean up old servers
            self._cleanUpOldVMS();
          });
        } else {
          self.emit('info', 'up to date');
          cb(null, null);
        }
      });
    });
  });
}

// may be invoked any time we suspect updates have occured to re-deploy
// if needed
Deployer.prototype.checkForUpdates = function(cb) {
  var self = this;
  self._pullLatest(function(err, sha) {
    if (!err) {
      console.log(sha);
    }
  });
}

var deployer = new Deployer();

[ 'info', 'ready', 'error', 'deployment_begins', 'deployment_complete', 'progress' ].forEach(function(evName) {
  deployer.on(evName, function(data) { console.log(evName + ":", data) });
});

deployer.on('ready', function() {
  deployer.checkForUpdates();
});
