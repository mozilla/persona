const
child_process = require('child_process'),
temp = require('temp'),
fs = require('fs');

const MAX_TRIES = 20;

exports.copyUpConfig = function(host, config, cb) {
  var tries = 0;
  temp.open({}, function(err, r) {
    fs.writeFileSync(r.path, JSON.stringify(config, null, 4));
    var cmd = 'scp -o "StrictHostKeyChecking no" ' + r.path + ' app@' + host + ":config.json";
    function oneTry() {
      child_process.exec(cmd, function(err, r) {
        if (err) {
          if (++tries > MAX_TRIES) return cb("can't connect via SSH.  stupid amazon");
          console.log("   ... nope.  not yet.  retrying.");
          setTimeout(oneTry, 5000);
        } else {
          cb();
        }
      });
    }
    oneTry();
  });
};
