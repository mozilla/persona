/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Lloyd Hilaiel <lloyd@hilaiel.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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

exports.installUpdateHandler = function(app, callback) {
  var terminate = connectionListener(app);
  app.get('/code_update', function(req, resp, next) {
    logger.warn("code updated.  closing " + app.connections + " connections and shutting down.");
    terminate(callback);
  });
};
