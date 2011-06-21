var   sys = require("sys"),
     path = require("path"),
       fs = require("fs"),
  express = require("express");

var PRIMARY_HOST = "127.0.0.1";
var PRIMARY_PORT = 62800;

var handler = require("./app.js");

var app = express.createServer().use(express.logger({
    stream: fs.createWriteStream(path.join(__dirname, "server.log"))
}));

// let the specific server interact directly with the express server to register their middleware
if (handler.setup) handler.setup(app);

app.listen(PRIMARY_PORT, PRIMARY_HOST);
