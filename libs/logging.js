const winston = require("winston");
const configuration = require("./configuration");

// go through the configuration and determine log location
// for now we only log to one place
// FIXME: separate logs depending on purpose?

var log_path = configuration.get('log_path');
var LOGGER = null;
if (log_path) {
  LOGGER= new (winston.Logger)({
      transports: [new (winston.transports.File)({filename: log_path})]
    });
}

// entry is an object that will get JSON'ified
exports.log = function(entry) {
  // entry must have at least a type
  if (!entry.type)
    throw new Error("every log entry needs a type");

  // FIXME: add timestamp

  // if no logger, go to console (FIXME: do we really want to log to console?)
  if (LOGGER)
    LOGGER.info(JSON.stringify(entry));
  else
    winston.info(JSON.stringify(entry));
};

// utility function to log a bunch of stuff at user entry point
exports.userEntry = function(req) {
  exports.log({
      type: 'signin',
      browser: req.headers['user-agent'],
      rp: req.headers['referer'],
      // FIXME: make sure we know where IP is: what header?
      ip: ""
    });
  console.log(JSON.stringify(req.headers));
};