#!/usr/bin/env node

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

// a little node webserver designed to run the unit tests herein

var      sys = require("sys"),
        http = require("http"),
         url = require("url"),
        path = require("path"),
          fs = require("fs"),
     express = require("express"),
substitution = require('./libs/substitute.js');

// when running under the harness, let's also output log messages to the terminal
require('./libs/logging.js').enableConsoleLogging();

var configuration = require('./libs/configuration.js');


var PRIMARY_HOST = "127.0.0.1";

var boundServers = [ ];

var subs = undefined;
function substitutionMiddleware(req, resp, next) {
  if (!subs) {
    subs = { };
    for (var i = 0; i < boundServers.length; i++) {
      var o = boundServers[i]
      var a = o.server.address();
      var from = o.name;
      var to = "http://" + a.address + ":" + a.port;
      subs[from] = to;

      // now do another replacement to catch bare hostnames sans http(s)
      // and explicit cases where port is appended
      var fromWithPort;
      if (from.substr(0,5) === 'https') {
        from = from.substr(8);
        fromWithPort = from + ":443";
      } else {
        from = from.substr(7);
        fromWithPort = from + ":80";
      }
      to = to.substr(7);

      if (o.subPath) to += o.subPath;

      subs[fromWithPort] = to;
      subs[from] = to;
    }
  }
  (substitution.substitute(subs))(req, resp, next);
}

function createServer(obj) {
  var app = express.createServer();

  // this file is a *test* harness, to make it go, we'll insert a little
  // handler that substitutes output, changing production URLs to
  // developement URLs.
  app.use(substitutionMiddleware);

  // let the specific server interact directly with the express server to
  // register their middleware, routes, etc...
  if (obj.setup) obj.setup(app);

  // now set up the static resource servin'
  var p = obj.path, ps = path.join(p, "static");
  try { if (fs.statSync(ps).isDirectory()) p = ps; } catch(e) { }
  app.use(express.static(p));

  // and listen!
  app.listen(obj.port, PRIMARY_HOST);
  return app;
};

// start up webservers on ephemeral ports for each subdirectory here.
var dirs = [
  // the reference verification server.  A version is hosted at
  // browserid.org and may be used, or the RP may perform their
  // own verification.
  {
    name: "https://browserid.org/verify",
    subPath: "/",
    path: path.join(__dirname, "verifier")
  },
  // An example relying party.
  {
    name: "http://rp.eyedee.me",
    path: path.join(__dirname, "rp")
  },

  // BrowserID: the secondary + ip + more.
  {
    name: "https://browserid.org",
    path: path.join(__dirname, "browserid")
  }
];

function formatLink(server, extraPath) {
  var addr = server.address();
  var url = 'http://' + addr.address + ':' + addr.port;
  if (extraPath) {
    url += extraPath;
  }
  return url;
}

console.log("Running test servers:");

var port_num=10000;
dirs.forEach(function(dirObj) {
  if (!fs.statSync(dirObj.path).isDirectory()) return;
  // does this server have a js handler for custom request handling?
  var handlerPath = path.join(dirObj.path, "app.js");
  var runJS = {};
  try {
    var runJSExists = false;
    try { runJSExists = fs.statSync(handlerPath).isFile() } catch(e) {};
    if (runJSExists) runJS = require(handlerPath);
  } catch(e) {
    console.log("Error loading " + handlerPath + ": " + e);
    process.exit(1);
  }

  var so = {
    path: dirObj.path,
    server: undefined,
    port: port_num++,
    name: dirObj.name,
    handler: runJS.handler,
    setup: runJS.setup,
    shutdown: runJS.shutdown,
    subPath: dirObj.subPath
  };
  so.server = createServer(so)
  boundServers.push(so);
  console.log("  " + dirObj.name + ": " + formatLink(so.server));
});

process.on('SIGINT', function () {
  console.log('\nSIGINT recieved! trying to shut down gracefully...');
  boundServers.forEach(function(bs) {
    if (bs.shutdown) bs.shutdown();
    bs.server.on('close', function() {
      console.log("server shutdown,", bs.server.connections, "connections still open...");
    });
    bs.server.close();
  });
  // exit more harshly in 700ms
  setTimeout(function() {
    console.log("exiting...");
    process.exit(0);
  }, 700);
});
