const fs = require('fs');

function FileReporter(config) {
  var fileName = config.output_path;

  var pathParts = fileName.split('/');
  // Ensure that all the directories in the path exist.
  // the last portion of the path will be the filename, remove it.
  pathParts.pop();

  var directoryPath = "";
  pathParts.forEach(function(directoryName) {
    directoryPath += "/" + directoryName;
    if (fs.existsSync(directoryPath)) {
      var directoryStats = fs.statSync(directoryPath);

      // If this path exists but is not a directory, we have a problems.
      if (!directoryStats.isDirectory()) {
        throw new Error("Cannot create directory: " + directoryPath);
      }
    }
    else {
      fs.mkdirSync(directoryPath, "0744");
    }
  });

  this.fd = fs.openSync(fileName, "a");
}
FileReporter.prototype.report = function(msg) {
  fs.writeSync(this.fd, msg, 0, msg.length, null);
};
FileReporter.prototype.done = function() {
  fs.closeSync(this.fd);
};

module.exports = FileReporter;
