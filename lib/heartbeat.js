/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
urlparse = require('urlparse'),
logger = require('./logging.js').logger,
url = require('url');

// the path that heartbeats live at
exports.path = '/__heartbeat__';

const checkTimeout = 5000;

// a helper function to set up a heartbeat check
exports.setup = function(app, options, cb) {
  var dependencies = [];

  if (typeof options == 'function') {
    cb = options;
  } else if (options && options.dependencies) {
    dependencies = options.dependencies;
  }
  var count = dependencies.length;

  app.use(function(req, res, next) {
    if (req.method !== 'GET' || req.path !== exports.path) {
      return next();
    }

    var checked = 0;
    var query = url.parse(req.url, true).query;
    var deep = typeof query.deep != 'undefined';
    var notOk = [];

    // callback for checking a dependency
    function checkCB (num) {
      return function (isOk, reason) {
        checked++;
        if (!isOk) {
          notOk.push(dependencies[num] + ': '+ reason);
        }

        // if all dependencies have been checked
        if (checked == count) {
          if (notOk.length === 0) {
            try {
              if (cb) cb(ok);
              else ok(true);
            } catch(e) {
              logger.error("Exception caught in heartbeat handler: " + e.toString());
              ok(false, e);
            }
          } else {
              logger.error("Not all dependencies are available");
              ok(false, '\n' + notOk.join('\n') + '\n');
          }
        }
      };
    }

    function ok(yeah, msg) {
      res.writeHead(yeah ? 200 : 500);
      res.write(yeah ? 'ok' : 'bad');
      if (msg) res.write(msg);
      res.end();
    }

    // check all dependencies if deep
    if (deep && count) {
      for (var i = 0; i < count; i++) {
        check(dependencies[i] + exports.path, checkCB(i));
      }
    } else {
      try {
        if (cb) cb(ok);
        else ok(true);
      } catch(e) {
        logger.error("Exception caught in heartbeat handler: " + e.toString());
        ok(false);
      }
    }
  });
};


// a function to check the heartbeat of a remote server
var check = exports.check = function(url, cb) {
  if (typeof url === 'string') url = urlparse(url).normalize().validate();
  else if (typeof url !== 'object') throw "url string or object required as argumnet to heartbeat.check";
  if (!url.port) url.port = (url.scheme === 'http') ? 80 : 443;

  var shortname = url.host + ':' + url.port;

  var timeoutHandle = setTimeout(function() {
    req.abort();
  }, checkTimeout);

  var req = require(url.scheme).get({
    host: url.host,
    port: url.port,
    path: exports.path
  }, function (res) {
    clearTimeout(timeoutHandle);
    if (res.statusCode === 200) cb(true);
    else {
      logger.error("non-200 response from " + shortname + ".  fatal! (" + res.statusCode + ")");
      cb(false, "response code " + res.statusCode);
    }
  });
  req.on('error', function (e) {
    clearTimeout(timeoutHandle);
    logger.error("can't communicate with " + shortname + ".  fatal: " + e);
    cb(false, e);
  });
};
