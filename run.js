// a little node webserver designed to run the unit tests herein

var   sys = require("sys"),
     http = require("http"),
      url = require("url"),
     path = require("path"),
       fs = require("fs"),
  connect = require("connect");

var PRIMARY_HOST = "127.0.0.1";

// all bound webservers stored in this lil' object
var boundServers = [ ];
function getSiteRef(host, port) {
  for (var i = 0; i < boundServers.length; i++) {
    var o = boundServers[i];
    var a = o.server.address();
    if (host === a.address && port === a.port) {
      return {
        root: o.path ? o.path : __dirname,
        handler: o.handler
      };
    }
  }
  return undefined;
}

function getServerByName(name) {
  for (var i = 0; i < boundServers.length; i++) {
    if (boundServers[i].name === name) return boundServers[i];
  }
  return undefined;
}

function serveFile(filename, response) {
  path.exists(filename, function(exists) {
    if(!exists) {
      response.writeHead(404, {"Content-Type": "text/plain"});
      response.write("404 Not Found");
      response.end();
      return;
    }

    fs.readFile(filename, "binary", function(err, data) {
      if(err) {
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.write(err + "\n");
        response.end();
        return;
      }

      var exts = {
        ".js":   "text/javascript",
        ".css":  "text/css",
        ".html": "text/html",
        ".webapp": "application/x-web-app-manifest+json",
        ".png": "image/png",
        ".ico": "image/x-icon"
      };

      var ext = path.extname(filename);
      var mimeType = exts[ext] || "application/octet-stream";

      for (var i = 0; i < boundServers.length; i++) {
        var o = boundServers[i]
        var a = o.server.address();
        var from = o.name + ".mozilla.org";
        var to = a.address + ":" + a.port;
        data = data.replace(from, to);
      }

      response.writeHead(200, {"Content-Type": mimeType});
      response.write(data, "binary");
      response.end();
    });
  });
}

function serveFileIndex(filename, response) {
  // automatically serve index.html if this is a directory
  fs.stat(filename, function(err, s) {
    if (err === null && s.isDirectory()) {
      serveFile(path.join(filename, "index.html"), response);
    } else {
      serveFile(filename, response);
    }
  });
}

function createServer(obj) {
  var server = connect.createServer().use(connect.favicon())
    .use(connect.logger({format: ":status :method :remote-addr :response-time :url"}));

  // if this site has a handler, we'll run that, otherwise serve statically
  if (obj.handler) {
    server.use(function(req, resp, next) {
      obj.handler(req, resp, serveFile);
    });
  } else {
    server.use(function(req, resp, next) {
      var filename = path.join(obj.path, url.parse(req.url).pathname);
      serveFileIndex(filename, resp);
    });
  }
  server.listen(obj.port, PRIMARY_HOST);
  return server;
};

// start up webservers on ephemeral ports for each subdirectory here.
var dirs = [ "authority", "rp" ].map(function(d) {
    return {
        name: d,
        path: path.join(__dirname, d)
    };
});

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
  var handlerPath = path.join(dirObj.path, "server", "run.js");
  var handler = undefined; 
  try {
    fs.statSync(handlerPath).isFile();
    handler = require(handlerPath).handler;
  } catch(e) {
  }

  var so = {
    path: dirObj.path,
    server: undefined,
    port: "0",
    name: dirObj.name,
    handler: handler
  };
  so.server = createServer(so)
  boundServers.push(so);
  console.log("  " + dirObj.name + ": " + formatLink(so.server));
});
