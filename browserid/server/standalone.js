var   sys = require("sys"),
     http = require("http"),
      url = require("url"),
     path = require("path"),
       fs = require("fs"),
  express = require("express");

var PRIMARY_HOST = "127.0.0.1";
var PRIMARY_PORT = 62700;

var handler = require("./app.js");

var app = express.createServer();

app.use(express.logger({
    stream: fs.createWriteStream(path.join(__dirname, "server.log"))
}));

// let the specific server interact directly with the connect server to register their middleware
if (handler.setup) handler.setup(app);

// use the express 'static' middleware for serving of static files (cache headers, HTTP range, etc)
app.use(express.static(path.join(path.dirname(__dirname), "static")));

app.listen(PRIMARY_PORT, PRIMARY_HOST);
