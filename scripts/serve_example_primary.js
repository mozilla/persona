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
querystring = require('querystring'),
sessions = require('connect-cookie-session'),
jwcrypto = require("jwcrypto");

// alg
require("jwcrypto/lib/algs/rs");
require("jwcrypto/lib/algs/ds");

var exampleServer = express.createServer();

exampleServer.use(express.cookieParser());

exampleServer.use(function(req, res, next) {
  if (/^\/api/.test(req.url)) {
    return sessions({
      secret: "this secret, isn't very secret",
      key: 'example_browserid_primary',
      cookie: {
        path: '/api',
        httpOnly: true,
        secure: false,
        maxAge: 1 * 60 * 60 * 1000
      }
    })(req, res, next);
  } else {
    next();
  }
});

exampleServer.use(express.logger({ format: 'dev' }));

if (process.env['PUBLIC_URL']) {
  var burl = urlparse(process.env['PUBLIC_URL']).validate().normalize().originOnly().toString();
  console.log('using browserid server at ' + burl);

  exampleServer.use(postprocess(function(req, buffer) {
    return buffer.toString().replace(new RegExp('https://login.persona.org', 'g'), burl);
  }));
}

exampleServer.use(express.static(path.join(__dirname, "..", "example", "primary")));

exampleServer.use(express.bodyParser());

const API_PREFIX = '/api/';

exampleServer.use(function(req, resp, next) {
  if (req.url.substr(0, API_PREFIX.length) === API_PREFIX) {
    resp.setHeader('Cache-Control', 'no-store, max-age=0');
  }
  next();
});

exampleServer.get("/api/whoami", function (req, res) {
  if (req.session && typeof req.session.user === 'string') return res.json(req.session.user);
  return res.json(null);
});

exampleServer.get("/api/login", function (req, res) {
  req.session = {user: req.query.user};
  return res.json(null);
});

exampleServer.get("/api/logout", function (req, res) {
  req.session = {};
  return res.json(null);
});

var _privKey = jwcrypto.loadSecretKey(
  require('fs').readFileSync(
    path.join(__dirname, '..', 'example', 'primary', 'sample.privatekey')));

exampleServer.post("/api/cert_key", function (req, res) {
  var user = req.session.user;

  var domain = process.env['SHIMMED_DOMAIN'];

  var expiration = new Date();
  var pubkey = jwcrypto.loadPublicKeyFromObject(req.body.pubkey);
  expiration.setTime(new Date().valueOf() + req.body.duration * 1000);
  jwcrypto.cert.sign(pubkey, {email: user + "@" + domain}, {issuer: domain, expiresAt: expiration, issuedAt: new Date()}, {}, _privKey, function(err, cert) {
    res.json({ cert: cert });
  });
});


exampleServer.listen(
  process.env['PORT'] || 10001,
  process.env['HOST'] || process.env['IP_ADDRESS'] || "127.0.0.1",
  function() {
    var addy = exampleServer.address();
    console.log("running on http://" + addy.address + ":" + addy.port);
  });
