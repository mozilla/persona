/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* code_update is a tiny abstraction of a handler that can be
 * used to shutdown gracefully upon signals, and can be used
 * to install a 'code_update' hook into a running express
 * server.
 */

const logger = require("./logging.js").logger;

const MAX_WAIT_MS = 10000;
const MAX_NICE_END_MS = 5000;

function connectionListener(app) {
  var connections = [];

  app.on('connection', function(c) {
    connections.push(c);
    c.on('close', function() {
      var where = connections.indexOf(c);
      if (where >= 0) connections.splice(where, 1);
    });
  });

  return function(callback) {
    if (!callback) callback = function(cli) { cli(); };

    var total_timeout = setTimeout(function() {
      logger.warn(MAX_WAIT_MS + "ms exceeded, going down forcefully...");
      setTimeout(function() { process.exit(1); }, 0);
    }, MAX_WAIT_MS);

    var nice_timeout = setTimeout(function() {
      logger.warn("forcefully closing " + connections.length + " remaining connections...");
      connections.forEach(function(c) { c.destroy() });
    }, MAX_NICE_END_MS);

    app.on('close', function() {
      function clearTimeoutsAndCallClient() {
        clearTimeout(nice_timeout);
        clearTimeout(total_timeout);
        callback(function() {
          logger.info("graceful shutdown complete...");
        });
      }

      // if there aren't any open connections, we're done!
      if (connections.length === 0) clearTimeoutsAndCallClient();

      connections.forEach(function(c) {
        c.on('close', function() {
          if (!app.connections && connections.length === 0) {
            // once all connections are shutdown, let's call the client
            // to let him shutdown all his open connections
            clearTimeoutsAndCallClient();
          }
        });
        c.end();
      });
    });
    app.close();
  }
};

exports.handleTerminationSignals = function(app, callback) {
  var gotSignal = false;
  var terminate = connectionListener(app);
  function endIt(signame) {
    return function() {
      if (gotSignal) return;
      gotSignal = true;
      logger.warn("SIG" + signame + " received.  closing " + app.connections + " connections and shutting down.");
      terminate(callback);
    };
  }

  process.on('SIGINT', endIt('INT')).on('SIGTERM', endIt('TERM')).on('SIGQUIT', endIt('QUIT'));
};

const CODE_UPDATE_URL = '/code_update';

exports.installUpdateHandler = function(app, callback) {
  var terminate = connectionListener(app);
  app.get(CODE_UPDATE_URL, function(req, resp, next) {
    // don't allow an imprecise match (like one with a trailing slash) to shut the server down.
    // bug #699171
    if (req.url !== CODE_UPDATE_URL) return next();

    logger.warn("code updated.  closing " + app.connections + " connections and shutting down.");
    terminate(callback);
  });
};
