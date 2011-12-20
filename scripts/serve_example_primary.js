#!/usr/bin/env node

// finally, let's run a tiny webserver for the example code.
const
express = require('express'),
path = require('path'),
urlparse = require('urlparse'),
postprocess = require('postprocess'),
querystring = require('querystring');

var exampleServer = express.createServer();

exampleServer.use(express.logger({ format: 'dev' }));

if (process.env['BROWSERID_URL']) {
  var burl = urlparse(process.env['BROWSERID_URL']).validate().normalize().originOnly().toString();
  console.log('using browserid server at ' + burl);

  exampleServer.use(postprocess.middleware(function(req, buffer) {
    return buffer.toString().replace(new RegExp('https://browserid.org', 'g'), burl);
  }));
}

exampleServer.use(express.static(path.join(__dirname, "..", "example", "primary")));

exampleServer.use(express.bodyParser());

// XXX: implement apis here

exampleServer.listen(
  process.env['PORT'] || 10001,
  process.env['HOST'] || process.env['IP_ADDRESS'] || "127.0.0.1",
  function() {
    var addy = exampleServer.address();
    console.log("running on http://" + addy.address + ":" + addy.port);
  });
