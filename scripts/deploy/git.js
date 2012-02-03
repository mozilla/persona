const
child_process = require('child_process');
spawn = child_process.spawn;

exports.addRemote = function(name, host, cb) {
  var cmd = 'git remote add ' + name  + ' app@'+ host + ':git';
  child_process.exec(cmd, cb);
};

// remove a remote, but only if it is pointed to a specific
// host.  This will keep deploy from killing manuall remotes
// that you've set up
exports.removeRemote = function(name, host, cb) {
  var desired = 'app@'+ host + ':git';
  var cmd = 'git remote -v show | grep push';
  child_process.exec(cmd, function(err, r) {
    try {
      var remotes = {};
      r.split('\n').forEach(function(line) {
        if (!line.length) return;
        var line = line.split('\t');
        if (!line.length == 2) return;
        remotes[line[0]] = line[1].split(" ")[0];
      });
      if (remotes[name] && remotes[name] === desired) {
        child_process.exec('git remote rm ' + name, cb);
      } else {
        throw "no such remote";
      }
    } catch(e) {
      cb(e);
    }
  });
};

exports.currentSHA = function(dir, cb) {
  if (typeof dir === 'function' && cb === undefined) {
    cb = dir;
    dir = path.join(__dirname, '..', '..');
  }

  var p = spawn('git', [ 'log', '--pretty=%h', '-1' ], { cwd: dir });
  var buf = "";
  p.stdout.on('data', function(d) {
    buf += d;
  });
  p.on('exit', function(code, signal) {
    var gitsha = buf.toString().trim();
    if (gitsha && gitsha.length === 7) {
      return cb(null, gitsha);
    }
    cb("can't extract git sha from " + dir);
  });
};

exports.push = function(dir, host, pr, cb) {
  if (typeof host === 'function' && cb === undefined) {
    cb = pr;
    pr = host;
    host = dir;
    dir = path.join(__dirname, '..', '..');
  }

  var p = spawn('git', [ 'push', 'app@' + host + ":git", 'dev:master' ], { cwd: dir });
  p.stdout.on('data', pr);
  p.stderr.on('data', pr);
  p.on('exit', function(code, signal) {
    return cb(code = 0);
  });
};