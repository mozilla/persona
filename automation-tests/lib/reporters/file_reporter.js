const fs          = require('fs'),
      mkdirp      = require('mkdirp'),
      path        = require('path'),
      existsSync  = fs.existsSync || path.existsSync;

function FileReporter(config) {
  var fileName = config.output_path;

  mkdirp.sync(path.dirname(fileName));

  this.fd = fs.openSync(fileName, "a");
}
FileReporter.prototype.report = function(msg) {
  fs.writeSync(this.fd, msg, 0, msg.length, null);
};
FileReporter.prototype.done = function() {
  fs.closeSync(this.fd);
};

module.exports = FileReporter;
