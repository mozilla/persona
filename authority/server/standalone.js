var   sys = require("sys"),
     http = require("http"),
      url = require("url"),
     path = require("path"),
       fs = require("fs"),
  connect = require("connect");

var PRIMARY_HOST = "127.0.0.1";
var PRIMARY_PORT = 62700;

var handler = require("./run.js");

function subHostNames(data) {
    return data;
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

var server = connect.createServer().use(connect.favicon())
    .use(connect.logger({format: ":status :method :remote-addr :response-time :url"}));

// let the specific server interact directly with the connect server to register their middleware 
if (handler.setup) handler.setup(server);

server.use(function(req, resp, next) {
    handler.handler(req, resp, serveFile, subHostNames);
});

server.listen(PRIMARY_PORT, PRIMARY_HOST);
