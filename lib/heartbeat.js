/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
urlparse = require('urlparse'),
logger = require('./logging.js').logger;

// the path that heartbeats live at
exports.path = '/__heartbeat__';

// a helper function to set up a heartbeat check
exports.setup = function(app, cb) {
  app.use(function(req, res, next) {
    if (req.method === 'GET' && req.path === exports.path) {
      function ok(yeah) {
        res.writeHead(yeah ? 200 : 500);
        res.write(yeah ? 'ok' : 'not ok');
        res.end();
      }
      try {
        if (cb) cb(ok);
        else ok(true);
      } catch(e) {
        logger.error("Exception caught in heartbeat handler: " + e.toString());
        ok(false);
      }
    } else {
      return next();
    }
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
