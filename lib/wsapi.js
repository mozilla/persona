/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs = require('fs');
const path = require('path');

const WSAPI_PREFIX = '/wsapi/';

// Exported to help run tests.
exports.allAPIs = function () {
  var APIs = {};

  fs.readdirSync(path.join(__dirname, 'wsapi')).forEach(function (f) {
    // skip files that don't have a .js suffix or start with a dot
    if (f.length <= 3 || f.substr(-3) !== '.js' || f.substr(0,1) === '.') return;
    var operation = f.substr(0, f.length - 3);

    var api = require(path.join(__dirname, 'wsapi', f));
    APIs[operation] = api;
  });

  return APIs;
}

// Originally used by the router process to decide where to send
// the request, either db_reader or db_writer. Terminate here.
// Should be all that's necessary to block all wsapi requests.
exports.routeSetup = function (app) {
  // Load all valid wsapi routes.
  const APIs = exports.allAPIs();

  for (var apiName in APIs) {
    var api = APIs[apiName];
    var pathname = WSAPI_PREFIX + apiName;
    // only routes that were originally available are now gone.
    app[api.method](pathname, function (req, res) {
      res.status(410).json({});
    });
  }
};
