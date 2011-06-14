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

function subHostNames(data) {
  for (var i = 0; i < boundServers.length; i++) {
    var o = boundServers[i]
    var a = o.server.address();
    var from = o.name;
    var to = "http://" + a.address + ":" + a.port;
    data = data.replace(new RegExp(from, 'g'), to);

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

      data = subHostNames(data);

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

  // let the specific server interact directly with the connect server to register their middleware 
  if (obj.setup) obj.setup(server);

  // if this site has a handler, we'll run that, otherwise serve statically
  if (obj.handler) {
    server.use(function(req, resp, next) {
      obj.handler(req, resp, serveFile, subHostNames);
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
        path: path.join(__dirname, "authority")
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
  var handlerPath = path.join(dirObj.path, "server", "run.js");
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
