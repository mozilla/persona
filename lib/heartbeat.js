const urlparse = require('urlparse');

// the path that heartbeats live at
exports.path = '/__heartbeat__';

// a helper function to set up a heartbeat check
exports.setup = function(app, cb) {
  app.get(exports.path, function(req, res) {
    function ok(yeah) {
      res.writeHead(yeah ? 200 : 500);
      res.write(yeah ? 'ok' : 'not ok');
      res.end();
    }
    if (cb) cb(ok);
    else ok(true);
  });
};

// a function to check the heartbeat of a remote server
exports.check = function(url, cb) {
  if (typeof url === 'string') url = urlparse(url).normalize().validate();
  else if (typeof url !== 'object') throw "url string or object required as argumnet to heartbeat.check";
  if (!url.port) url.port = (url.scheme === 'http') ? 80 : 443;

  var shortname = url.host + ':' + url.port;

  require(url.scheme).get({
    host: url.host,
    port: url.port,
    path: exports.path
  }, function (res) {
    if (res.statusCode === 200) cb(true);
    else logger.error("non-200 response from " + shortname + ".  fatal! (" + res.statusCode + ")");
  }, function (e) {
    logger.error("can't communicate with " + shortname + ".  fatal: " + e);
    cb(false);
  });
};