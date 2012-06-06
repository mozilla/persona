/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
url = require('url'),
http = require('http'),
https = require('https'),
logger = require('./logging.js').logger,
querystring = require('querystring');

var global_forward_timeout = undefined;

exports.setTimeout = function(to) {
  if (typeof to != 'number') throw "setTimeout expects a numeric argument";
  global_forward_timeout = to;
};

exports.forward = function(dest, req, res, cb) {
  var _cb = cb;
  var requestTimeout = undefined;
  cb = function() {
    if (requestTimeout) clearTimeout(requestTimeout);
    if (_cb) _cb.apply(null, arguments);
  }

  function cleanupReq() {
    if (preq) {
      preq.removeAllListeners();
      preq.destroy();
      preq = undefined;
    }
  }

  var u = url.parse(dest.toString());

  var m = u.protocol === 'http:' ? http : https;

  var preq = m.request({
    host: u.hostname,
    port: u.port,
    path: u.path,
    method: req.method,
    agent: false
  }, function(pres) {

    res.statusCode = pres.statusCode;

    // forward necessary headers
    ['Content-Type', 'Content-Length', 'Set-Cookie', 'Vary', 'Cache-Control', 'ETag', 'X-Frame-Options', 'Location']
      .forEach(function (header) {
        if (pres.headers.hasOwnProperty(header.toLowerCase())) {
          res.setHeader(header, pres.headers[header.toLowerCase()]);
        }
      });

    pres.on('data', function (chunk) {
      res.write(chunk);
    }).on('end', function() {
      res.end();
      pres.removeAllListeners();
      pres.destroy();
      pres = undefined;
      cleanupReq();
      cb();
    });
  }).on('error', function(e) {
    cleanupReq();
    cb(e);
  });

  if (global_forward_timeout) {
    requestTimeout = setTimeout(function() { preq.destroy(); }, global_forward_timeout);
  }

  if (req.headers['content-type']) {
    preq.setHeader('Content-Type', req.headers['content-type']);
  }

  // forward cookies
  if (req.headers['cookie']) {
    preq.setHeader('Cookie', req.headers['cookie']);
  }

  // forward header
  if (req.headers['accept-language']) {
    preq.setHeader('Accept-Language', req.headers['accept-language']);
  }
  if (req.headers['if-none-match']) {
    preq.setHeader('If-None-Match', req.headers['if-none-match']);
  }

  if (req.headers['user-agent'] && '/wsapi/interaction_data' === req.path) {
    preq.setHeader('User-Agent', req.headers['user-agent']);
  }

  // if the body has already been parsed, we'll write it
  if (req.body) {
    var data;
    if (req.headers['content-type'].indexOf('application/json') === 0) data = JSON.stringify(req.body);
    else data = querystring.stringify(req.body);
    preq.setHeader('content-length', Buffer.byteLength(data));
    preq.write(data);
    preq.end();
  } else {
    req.on('data', function(chunk) { preq.write(chunk) })
      .on('end', function() { preq.end() });
  }
  logger.info("forwarding request: " + req.url + " -> " + dest);
};
