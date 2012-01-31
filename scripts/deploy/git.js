const
child_process = require('child_process');

exports.addRemote = function(name, host, cb) {
  var cmd = 'git remote add ' + name  + ' app@'+ host + ':git';
  child_process.exec(cmd, cb);
};
