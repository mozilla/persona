const
fs = require('fs'),
path = require('path'),
mkdirp = require('mkdirp'),
logger = require('../lib/logging').logger,
version = require('../lib/version.js');

module.exports = function(cb) {
  var buildDirPath = path.join(__dirname, "..", "resources", "static", "build");
  // Make sure the build path is there or an exception is thrown when writing
  // to the output file.
  mkdirp.sync(buildDirPath);
  var codeVersionPath = path.join(buildDirPath, "code_version.js");

  // Only update code_version.js IFF the currCodeVersion is different to the
  // version that is already written to disk. An unnecesary update to
  // curr_version.js forces a re-build of all locales during compress.
  version(function(currCodeVersion) {
    fs.readFile(codeVersionPath, 'utf8', function(err, data) {
      if (err) {
        if (err.code === "ENOENT") {
          // file doesn't exist? no problem. No need to compare versions, just
          // write it out.
          return writeCodeVersion();
        }

        // Something more serious is happening, uh oh.
        var msg = "Error reading " + codeVersionPath + ": " + String(err);
        console.error(msg);
        return logger.error(msg);
      }

      // No error, get the saved code version and compare it to the
      // currCodeVersion. If the saved version is not the same as currCodeVersion,
      // write a new file out.
      var versionRegExp = /^BrowserID\.CODE_VERSION = '(\w*)/;
      var savedCodeVersion = String(data).match(versionRegExp)[1];
      if (savedCodeVersion !== currCodeVersion) {
        writeCodeVersion();
      }
      else {
        console.info('code_version.js already up to date');
        cb && cb();
      }

      function writeCodeVersion() {
        console.info('code_version.js needs to be updated to: ' + currCodeVersion);

        var contents = "BrowserID.CODE_VERSION = '" + currCodeVersion + "';\n";
        fs.writeFile(codeVersionPath, contents, 'utf8', function (err) {
          if (err) {
            var msg = "Error writing " + codeVersionPath + ": " + String(err);
            console.error(msg);
            return logger.error(msg);
          }

          cb && cb();
        });
      }
    });
  });
};
