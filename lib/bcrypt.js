const
computecluster = require('compute-cluster'),
logger = require('../lib/logging.js').logger,
bcrypt = require('bcrypt');

var cc = new computecluster({
  module: path.join(__dirname, "bcrypt-compute.js"),
  max_backlog: 100000
});

cc.on('error', function(e) {
  logger.error("error detected in bcrypt computation process!  fatal: " + e.toString());
  setTimeout(function() { process.exit(1); }, 0);
}).on('info', function(msg) {
  logger.info("(compute cluster): " + msg);
}).on('debug', function(msg) {
  logger.debug("(compute cluster): " + msg);
});

exports.encrypt = function(workFactor, password, cb) {
  if (!cc) throw "bcrypt cluster is shut down";
  cc.enqueue({
    op: 'encrypt',
    factor: workFactor,
    pass: password
  }, function(err, r) {
    cb(err, r ? r.r : undefined);
  });
};

exports.compare = function(pass, hash, cb) {
  if (!cc) throw "bcrypt cluster is shut down";
  cc.enqueue({
    op: 'compare',
    pass: pass,
    hash: hash
  }, function(err, r) {
    cb(err, r ? r.r : undefined);
  })
};

exports.get_rounds = function(hash) {
  return bcrypt.get_rounds(hash);
};

exports.shutdown = function() {
  if (cc) {
    cc.exit();
    cc = undefined;
  }
};
