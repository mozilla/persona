#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// finally, let's run a tiny webserver for the example code.
const
express = require('express'),
path = require('path'),
urlparse = require('urlparse'),
postprocess = require('postprocess'),
querystring = require('querystring');

var exampleServer = express.createServer();

exampleServer.use(express.logger({ format: 'dev' }));

if (process.env['PUBLIC_URL']) {
  var burl = urlparse(process.env['PUBLIC_URL']).validate().normalize().originOnly().toString();
  console.log('using browserid server at ' + burl);

  exampleServer.use(postprocess(function(req, buffer) {
    return buffer.toString().replace(new RegExp('https://login.persona.org', 'g'), burl);
  }));
}

exampleServer.use(express.static(path.join(__dirname, "..", "example", "rp")));

exampleServer.use(express.bodyParser());

exampleServer.post('/process_assertion', function(req, res, next) {
  var verifier = urlparse(process.env['VERIFIER_URL']);
  var meth = verifier.scheme === 'http' ? require('http') : require('https');

  var vreq = meth.request({
    host: verifier.host,
    port: verifier.port,
    path: verifier.path,
    method: 'POST'
  }, function(vres) {
    var body = "";
    vres.on('data', function(chunk) { body+=chunk; } )
        .on('end', function() {
          try {
            console.log(body);
            var verifierResp = JSON.parse(body);
            var valid = verifierResp && verifierResp.status === "okay";
            var email = valid ? verifierResp.email : null;
            if (valid) {
              console.log("assertion verified successfully for email:", email);
            } else {
              console.log("failed to verify assertion:", verifierResp.reason);
            }
            res.json(verifierResp);
          } catch(e) {
            console.log("non-JSON response from verifier");
            // bogus response from verifier!  return null
            res.json(null);
          }
        });
  });
  vreq.setHeader('Content-Type', 'application/x-www-form-urlencoded');

  // An "audience" argument is embedded in the assertion and must match our hostname.
  // Because this one server runs on multiple different domain names we just use
  // the host parameter out of the request.
  var audience = req.headers['host'] ? req.headers['host'] : localHostname;
  var data = querystring.stringify({
    assertion: req.body.assertion,
    audience: audience
  });
  vreq.setHeader('Content-Length', data.length);
  vreq.write(data);
  vreq.end();
  console.log("verifying assertion!");

});

exampleServer.listen(
  process.env['PORT'] || 10001,
  process.env['HOST'] || process.env['IP_ADDRESS'] || "127.0.0.1",
  function() {
    var addy = exampleServer.address();
    console.log("running on http://" + addy.address + ":" + addy.port);
  });
