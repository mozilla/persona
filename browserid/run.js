#!/usr/bin/env node

var  path = require("path"),
     fs = require("fs"),
     express = require("express");

const amMain = (process.argv[1] === __filename);

const PRIMARY_HOST = "127.0.0.1";
const PRIMARY_PORT = 62700;

var handler = require("./app.js");

var app = undefined;

exports.runServer = function() {
  if (app) return;

  app = express.createServer();

  app.use(express.logger({
    stream: fs.createWriteStream(path.join(handler.varDir, "server.log"))
  }));

  // let the specific server interact directly with the connect server to register their middleware
  if (handler.setup) handler.setup(app);

  // use the express 'static' middleware for serving of static files (cache headers, HTTP range, etc)
  app.use(express.static(path.join(__dirname, "static")));

  app.listen(PRIMARY_PORT, PRIMARY_HOST);
};

exports.stopServer = function(cb) {
  if (!app) return;
  app.on('close', function() {
    cb();
  });
  app.close();
  app = undefined;
}

// when directly invoked from the command line, we'll start the server
if (amMain) exports.runServer();
