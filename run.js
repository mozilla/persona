#!/usr/bin/env node

// a little node webserver designed to run the unit tests herein

var   sys = require("sys"),
     http = require("http"),
      url = require("url"),
     path = require("path"),
       fs = require("fs"),
  express = require("express");

var PRIMARY_HOST = "127.0.0.1";

var boundServers = [ ];

// given a buffer, find and replace all production hostnames
// with development URLs
function subHostNames(data) {
  for (var i = 0; i < boundServers.length; i++) {
    var o = boundServers[i]
    var a = o.server.address();
    var from = o.name;
    var to = "http://" + a.address + ":" + a.port;
    data = data.toString().replace(new RegExp(from, 'g'), to);

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

    data = data.replace(new RegExp(fromWithPort, 'g'), to);
    data = data.replace(new RegExp(from, 'g'), to);
  }

  return data;
}

// Middleware that intercepts outbound textual responses and substitutes
// in development hostnames
function substitutionMiddleware(req, resp, next) {
    // cache the *real* functions
    var realWrite = resp.write;
    var realEnd = resp.end;
    var realWriteHead = resp.writeHead;

    var buf = undefined;
    var enc = undefined;
    var contentType = undefined;

    resp.writeHead = function (sc, reason, hdrs) {
        var h = undefined;
        if (typeof hdrs === 'object') h = hdrs;
        else if (typeof reason === 'object') h = reason; 
        for (var k in h) {
            if (k.toLowerCase() === 'content-type') {
                contentType = h[k];
                break;
            }
        }
        if (!contentType) contentType = resp.getHeader('content-type');
        if (!contentType) contentType = "application/unknown";
        realWriteHead(sc, reason, hdrs);
    };

    resp.write = function (chunk, encoding) {
        if (buf) buf += chunk;
        else buf = chunk;
        enc = encoding;
    };

    resp.end = function() {
        if (!contentType) contentType = resp.getHeader('content-type');
        if (contentType && (contentType === "application/javascript" ||
                            contentType.substr(0,4) === 'text'))
        {
            if (buf) {
                var l = buf.length;
                buf = subHostNames(buf);
                if (l != buf.length) resp.setHeader('Content-Length', buf.length);
            }
        }
        if (buf && buf.length) realWrite.call(resp, buf, enc);
        realEnd.call(resp);
    }

    next();
};

function createServer(obj) {
    var app = express.createServer();
    app.use(express.logger());

    // this file is a *test* harness, to make it go, we'll insert a little handler that
    // substitutes output, changing production URLs to developement URLs.
    app.use(substitutionMiddleware);

    // let the specific server interact directly with the express server to register their middleware,
    // routes, etc...
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
    // A reference primary identity provider.
    {
        name: "https://eyedee.me",
        path: path.join(__dirname, "primary")
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
dirs.forEach(function(dirObj) {
  if (!fs.statSync(dirObj.path).isDirectory()) return;
  // does this server have a js handler for custom request handling?
  var handlerPath = path.join(dirObj.path, "server", "app.js");
  var runJS = {};
  try {
    var runJSExists = false;
    try { runJSExists = fs.statSync(handlerPath).isFile() } catch(e) {};
    if (runJSExists) {
      var runJS = require(handlerPath);
    }
  } catch(e) {
    console.log("Error loading " + handlerPath + ": " + e);
    process.exit(1);
  }

  var so = {
    path: dirObj.path,
    server: undefined,
    port: "0",
    name: dirObj.name,
    handler: runJS.handler,
    setup: runJS.setup,
    subPath: dirObj.subPath
  };
  so.server = createServer(so)
  boundServers.push(so);
  console.log("  " + dirObj.name + ": " + formatLink(so.server));
});
