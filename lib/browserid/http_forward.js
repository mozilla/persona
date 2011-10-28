const
url = require('url'),
http = require('http'),
https = require('https'),
logger = require('logging.js').logger;

module.exports = function(dest, req, res, cb) {
  var u = url.parse(dest);

  var m = u.protocol === 'http:' ? http : https;

  var preq = m.request({
    host: u.hostname,
    port: u.port,
    path: u.pathname,
    method: req.method
  }, function(pres) {
    res.writeHead(
      pres.statusCode,
      pres.headers
    );
    pres.on('data', function (chunk) {
      res.write(chunk);
    }).on('end', function() {
      res.end();
      cb();
    });
  }).on('error', function(e) {
    res.end();
    cb(e);
  });

  if (req.headers['content-type']) {
    preq.setHeader('content-type', req.headers['content-type']);
  }

  req.on('data', function(chunk) { preq.write(chunk) })
     .on('end', function() { preq.end() });

  logger.info("forwarding request to " + dest);
};