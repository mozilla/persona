const fs          = require('fs'),
      mkdirp      = require('mkdirp'),
      path        = require('path'),
      existsSync  = fs.existsSync || path.existsSync;

function FileReporter(config) {
  var fileName = config.output_path;
  this.fileName = fileName;

  try {
    mkdirp.sync(path.dirname(fileName));

    this.fd = fs.openSync(fileName, "w");
  }
  catch(e) {
    console.log("error:", this.fileName, String(e));
  }
}
FileReporter.prototype.report = function(msg) {
  try {
    fs.writeSync(this.fd, msg, 0, msg.length, null);
  }
  catch(e) {
    console.log("error:", this.fileName, String(e));
  }
};
FileReporter.prototype.done = function() {
  try {
    fs.closeSync(this.fd);
  }
  catch(e) {
    console.log("error:", this.fileName, String(e));
  }
};

module.exports = FileReporter;
