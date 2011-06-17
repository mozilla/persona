var   sys = require("sys"),
     http = require("http"),
      url = require("url"),
     path = require("path"),
       fs = require("fs"),
  connect = require("connect");

var PRIMARY_HOST = "127.0.0.1";
var PRIMARY_PORT = 62700;

var handler = require("./run.js");

var server = connect.createServer().use(connect.favicon())
    .use(connect.logger({
        stream: fs.createWriteStream(path.join(__dirname, "server.log"))
    }));

// let the specific server interact directly with the connect server to register their middleware
if (handler.setup) handler.setup(server);

server.use(handler.handler);

// use the connect 'static' middleware for serving of static files (cache headers, HTTP range, etc)
server.use(connect.static(path.join(path.dirname(__dirname), "static")));

server.listen(PRIMARY_PORT, PRIMARY_HOST);
