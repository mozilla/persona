#!/usr/bin/env node

var   sys = require("sys"),
     path = require("path"),
       fs = require("fs"),
  express = require("express");

var PRIMARY_HOST = "127.0.0.1";
var PRIMARY_PORT = 62900;

var handler = require("./app.js");

var app = express.createServer();

app.use(express.logger({
    stream: fs.createWriteStream(path.join(handler.varDir, "server.log"))
}));

// let the specific server interact directly with the connect server to register their middleware
if (handler.setup) handler.setup(app);

// use the connect 'static' middleware for serving of static files (cache headers, HTTP range, etc)
app.use(express.static(path.join(__dirname, "static")));

app.listen(PRIMARY_PORT, PRIMARY_HOST);
