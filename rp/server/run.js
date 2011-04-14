const path = require('path'),
       url = require('url'),
     wsapi = require('./wsapi.js'),
 httputils = require('./httputils.js'),
   connect = require('connect'),
        fs = require('fs'),
    verify = require('./verify.js');

const STATIC_DIR = path.join(path.dirname(__dirname), "static");

exports.handler = function(request, response, serveFile, subHostNames) {
  // dispatch!
  var urlpath = url.parse(request.url).pathname;

  if (urlpath === '/login') {
    verify.performVerfication(subHostNames("http://verifier.mozilla.org"), subHostNames("rp.mozilla.org"), request, response);
  } else {
    // node.js takes care of sanitizing the request path
    // automatically serve index.html if this is a directory
    var filename = path.join(STATIC_DIR, urlpath)
    fs.stat(filename, function(err, s) {
      if (err === null && s.isDirectory()) {
        serveFile(path.join(filename, "index.html"), response);
      } else {
        serveFile(filename, response);
      }
    });
  }
};

exports.setup = function(server) {
  var week = (7 * 24 * 60 * 60 * 1000);

  server
    .use(connect.cookieParser())
    .use(connect.session({
      secret: "rhodesian ridgeback",
      cookie: {
        path: '/',
        httpOnly: true,
        expires:  new Date(Date.now() + week),// a week XXX: think about session security, etc
        maxAge: week
      }
    }));
}
