#!/usr/bin/env node

const
temp = require('temp'),
path = require('path'),
util = require('util'),
events = require('events'),
git = require('./deploy/git.js'),
https = require('https'),
vm = require('./deploy/vm.js'),
jsel = require('JSONSelect'),
fs = require('fs'),
express = require('express');

console.log("deploy server starting up");

// a class capable of deploying and emmitting events along the way
function Deployer() {
  events.EventEmitter.call(this);

  // a directory where we'll keep code
  this._codeDir = process.env['CODE_DIR'] || temp.mkdirSync();
  console.log("code dir is:", this._codeDir);
  var self = this;

  git.init(this._codeDir, function(err) {
    if (err) {
      console.log("can't init code dir:", err);
      process.exit(1);
    }
    self.emit('ready');
  });
}

util.inherits(Deployer, events.EventEmitter);

Deployer.prototype._getLatestRunningSHA = function(cb) {
  var self = this;

  // failure is not fatal.  maybe nothing is running?
  var fail = function(err) {
    self.emit('info', { msg: "can't get current running sha", reason: err });
    cb(null, null);
  }

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

Deployer.prototype._cleanUpOldVMs = function() {
  var self = this;
  // what's our sha
  git.currentSHA(self._codeDir, function(err, latest) {
    if (err) return self.emit('info', err);
    vm.list(function(err, r) {
      if (err) return self.emit('info', err);
      // only check the vms that have 'dev.diresworb.org' as a name
      jsel.forEach("object:has(:root > .name:contains(?))", [ "dev.diresworb.org" ], r, function(o) {
        // don't delete the current one
        if (o.name.indexOf(latest) == -1) {
          self.emit('info', 'decommissioning VM: ' + o.name + ' - ' + o.instanceId);
          vm.destroy(o.name, function(err, r) {
            if (err) self.emit('info', 'decomissioning failed: ' + err);
            else self.emit('info', 'decomissioning succeeded of ' + r);
          })
        }
      });
    });
  });
}

Deployer.prototype._deployNewCode = function(cb) {
  var self = this;

  function splitAndEmit(chunk) {
    if (chunk) chunk = chunk.toString();
    if (typeof chunk === 'string') {
      chunk.split('\n').forEach(function (line) {
        line = line.trim();
        if (line.length) self.emit('progress', line);
      });
    }
  }

  var npmInstall = spawn('npm', [ 'install' ], { cwd: self._codeDir });

  npmInstall.stdout.on('data', splitAndEmit);
  npmInstall.stderr.on('data', splitAndEmit);

  npmInstall.on('exit', function(code, signal) {
    if (code != 0) {
      self.emit('error', "can't npm install to prepare to run deploy_dev");
      return;
    }
    var p = spawn('scripts/deploy_dev.js', [], { cwd: self._codeDir });

    p.stdout.on('data', splitAndEmit);
    p.stderr.on('data', splitAndEmit);

    p.on('exit', function(code, signal) {
      return cb(code != 0);
    });
  });
};

Deployer.prototype._pullLatest = function(cb) {
  var self = this;
  git.pull(this._codeDir, 'git://github.com/mozilla/browserid', 'dev', function(l) {
    self.emit('progress', l);
  }, function(err) {
    if (err) return cb(err);
    git.currentSHA(self._codeDir, function(err, latest) {
      if (err) return cb(err);
      self.emit('info', 'latest available sha is ' + latest);
      self._getLatestRunningSHA(function(err, running) {
        if (latest != running) {
          self.emit('deployment_begins', {
            sha: latest,
          });
          var startTime = new Date();

          self._deployNewCode(function(err, res) {
            if (err) return cb(err);
            // deployment is complete!
            self.emit('deployment_complete', {
              sha: latest,
              time: (startTime - new Date())
            });
            // finally, let's clean up old servers
            self._cleanUpOldVMs();
            cb(null, null);
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
Deployer.prototype.checkForUpdates = function() {
  var self = this;

  if (this._busy) return;

  this._busy = true;
  self.emit('info', 'checking for updates');

  self._pullLatest(function(err, sha) {
    if (err) self.emit('error', err);
    self._busy = false;
  });
}

var deployer = new Deployer();

var currentLogFile = null;
// a directory where we'll deployment logs
var deployLogDir = process.env['DEPLOY_LOG_DIR'] || temp.mkdirSync();

var deployingSHA = null;

console.log("deployment log dir is:", deployLogDir);

[ 'info', 'ready', 'error', 'deployment_begins', 'deployment_complete', 'progress' ].forEach(function(evName) {
  deployer.on(evName, function(data) {
    if (typeof data != 'string') data = JSON.stringify(data, null, 2);
    var msg = evName + ": " + data;
    console.log(msg)
    if (currentLogFile) currentLogFile.write(msg + "\n");
  });
});

// now when deployment begins, we log all events
deployer.on('deployment_begins', function(r) {
  currentLogFile = fs.createWriteStream(path.join(deployLogDir, r.sha + ".txt"));
  currentLogFile.write("deployment of " + r.sha + " begins\n");
  deployingSHA = r.sha;
});

function closeLogFile() {
  if (currentLogFile) {
    currentLogFile.end();
    currentLogFile = null;
  }
}

deployer.on('deployment_complete', function(r) {
  closeLogFile();
  deployingSHA = null;

  // always check to see if we should try another deployment after one succeeds to handle rapid fire
  // commits
  deployer.checkForUpdates();
});

deployer.on('error', function(r) {
  closeLogFile();
  deployingSHA = null;

  // on error, try again in 2 minutes
  setTimeout(function () {
    deployer.checkForUpdates();
  }, 2 * 60 * 1000);
});


// we check every 30 minutes no mattah what. (checks are cheap)
setInterval(function () {
  deployer.checkForUpdates();
}, (1000 * 60 * 30));

// check for updates at startup
deployer.on('ready', function() {
  deployer.checkForUpdates();

  var app = express.createServer();

  app.get('/check', function(req, res) {
    deployer.checkForUpdates();
    res.send('ok');
  });

  app.get('/', function(req, res) {
    var what = "idle";
    if (deployingSHA) what = "deploying " + deployingSHA;
    res.send(what);
  });

  app.use(express.static(deployLogDir));

  app.listen(process.env['PORT'] || 8080, function() {
    console.log("deploy server bound");
  });
});
