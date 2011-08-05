const
winston = require("winston"),
configuration = require("./configuration"),
path = require('path'),
fs = require('fs');

// go through the configuration and determine log location
// for now we only log to one place
// FIXME: separate logs depending on purpose?

var log_path = configuration.get('log_path');
var LOGGERS = [];

// simple inline function for creation of dirs
function mkdir_p(p) {
  if (!path.existsSync(p)) {
    mkdir_p(path.dirname(p));
    console.log("mkdir", p);
    fs.mkdirSync(p, "0755");
  }
}

function setupLogger(category) {
  if (!log_path)
    return console.log("no log path! Not logging!");
  else
    mkdir_p(log_path);


  // don't create the logger if it already exists
  if (LOGGERS[category])
    return;

  var filename = path.join(log_path, category + "-log.txt");

  LOGGERS[category] = new (winston.Logger)({
      transports: [new (winston.transports.File)({filename: filename})]
    });
}

// entry is an object that will get JSON'ified
exports.log = function(category, entry) {
  // entry must have at least a type
  if (!entry.type)
    throw new Error("every log entry needs a type");

  // setup the logger if need be
  setupLogger(category);

  // timestamp
  entry.at = new Date().toUTCString();

  // if no logger, go to console (FIXME: do we really want to log to console?)
  LOGGERS[category].info(JSON.stringify(entry));
};

// utility function to log a bunch of stuff at user entry point
exports.userEntry = function(category, req) {
  exports.log(category, {
      type: 'signin',
      browser: req.headers['user-agent'],
      rp: req.headers['referer'],
      // IP address (this probably needs to be replaced with the X-forwarded-for value
      ip: req.connection.remoteAddress
    });
};