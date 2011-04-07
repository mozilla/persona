// a little node webserver designed to run the unit tests herein

var sys = require("sys"),
http = require("http"),
url = require("url"),
path = require("path"),
fs = require("fs");

var PRIMARY_HOST = "127.0.0.1";

// all bound webservers stored in this lil' object
var boundServers = [ ];
function getWebRootDir(host, port) {
  for (var i = 0; i < boundServers.length; i++) {
    var o = boundServers[i];
    var a = o.server.address();
    if (host === a.address && port === a.port) {
      return o.path ? o.path : __dirname;
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

function fourOhFour(resp, reason) {
  resp.writeHead(404, {"Content-Type": "text/plain"});
  resp.write("404 Not Found");
  if (reason) {
    resp.write(": " + reason);
  }
  resp.end();
  return undefined;
}

function createServer(port) {
  var myserver = http.createServer(function(request, response) {
    var hostname = request.headers['host'].toString("utf8");
    var port = parseInt(hostname.split(':')[1]);
    var host = hostname.split(':')[0];

    // normalize 'localhost', so it just works.
    if (host === 'localhost') {
      var redirectURL = "http://127.0.0.1:" + port + request.url;
      response.writeHead(302, {"Location": redirectURL});
      response.end();
      return;
    }

    // get the directory associated with the port hit by client
    var siteroot = getWebRootDir(host, port);

    // unknown site?  really?
    if (!siteroot) return fourOhFour(response, "No site on this port");

    var serveFile = function (filename) {
      path.exists(filename, function(exists) {
        if(!exists) {
          response.writeHead(404, {"Content-Type": "text/plain"});
          response.write("404 Not Found");
          response.end();
          sys.puts("404 " + filename);
          return;
        }

        fs.readFile(filename, "binary", function(err, data) {
          if(err) {
            response.writeHead(500, {"Content-Type": "text/plain"});
            response.write(err + "\n");
            response.end();
            sys.puts("500 " + filename);
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
            console.log("replace: " + from + " with " + to); 
            data = data.replace(from, to);
          }

          response.writeHead(200, {"Content-Type": mimeType});
          response.write(data, "binary");
          response.end();
          sys.puts("200 " + filename);
        });
      });
    };


    function serveFileIndex(filename) {
      // automatically serve index.html if this is a directory
      fs.stat(filename, function(err, s) {
        if (err === null && s.isDirectory()) {
          serveFile(path.join(filename, "index.html"));
        } else {
          serveFile(filename);
        }
      });
    }

    var filename = path.join(siteroot, url.parse(request.url).pathname);

    if (siteroot == __dirname) {
      // We're layering two directories in this case
      var otherPath = path.join(__dirname, '..', url.parse(request.url).pathname);
      path.exists(otherPath, function(exists) {
        if (exists) {
          serveFileIndex(otherPath);
        } else {
          serveFileIndex(filename);
        }
      });
    } else {
      serveFileIndex(filename);
    }
  });
  myserver.listen(port, PRIMARY_HOST);
  return myserver;
};

// start up webservers on ephemeral ports for each subdirectory here.
var dirs = [ "authority", "rp" ].map(function(d) {
    return {
        name: d,
        path: path.join(__dirname, d)
    };
});

function formatLink(nameOrServer, extraPath) {
  if (typeof nameOrServer == 'string') {
    nameOrServer = getServerByName(nameOrServer).server;
  }
  var addr = nameOrServer.address();
  var url = 'http://' + addr.address + ':' + addr.port;
  if (extraPath) {
    url += extraPath;
  }
  return url;
}

console.log("Running test servers:");
dirs.forEach(function(dirObj) {
  if (!fs.statSync(dirObj.path).isDirectory()) return;
  boundServers.push({
    path: dirObj.path,
    server: createServer(0),
    name: dirObj.name
  });
  console.log("  " + dirObj.name + ": " + formatLink(dirObj.name));
});
