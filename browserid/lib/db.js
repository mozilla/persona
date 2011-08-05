var driver;

var ready = false;
var waiting = [];

function checkReady() {
  if (!ready) throw "database not ready.  did you call open()?";
}

// async break allow database path to be configured by calling code
// a touch tricky cause client must set dbPath before releasing
// control of the runloop
exports.open = function(cfg, cb) {
  var driverName = "json";
  if (cfg && cfg.driver) driverName = cfg.driver;
  try {
    driver = require('./db_' + driverName + '.js');
  } catch(e) {
    var msg = "FATAL: couldn't find database driver: " + driverName;
    console.log(msg);
    throw msg + ": " + e.toString();
  }

  driver.open(cfg, function(error) {
    if (error) {
      if (cb) cb(error);
      else {
        console.log("ERROR:" + error);
        process.exit(1);
      }
    } else {
      ready = true;
      waiting.forEach(function(f) { f() });
      waiting = [];
      if (cb) cb();
    }
  });
};


exports.close = function(cb) {
  driver.close(function(err) {
    ready = false;
    cb(err);
  });
};

// accepts a function that will be invoked once the database is ready for transactions.
// this hook is important to pause the rest of application startup until async database
// connection establishment is complete.
exports.onReady = function(f) {
  setTimeout(function() {
    if (ready) f();
    else waiting.push(f);
  }, 0);
};

[
  'emailKnown',
  'isStaged',
  'emailsBelongToSameAccount',
  'addKeyToEmail',
  'stageUser',
  'stageEmail',
  'gotVerificationSecret',
  'checkAuth',
  'getSyncResponse',
  'pubkeysForEmail',
  'removeEmail',
  'cancelAccount'
].forEach(function(fn) {
  exports[fn] = function() {
    checkReady();
    driver[fn].apply(undefined, arguments);
  };
});
