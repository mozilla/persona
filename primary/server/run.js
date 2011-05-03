const        path = require('path'),
              url = require('url'),
            wsapi = require('./wsapi.js'),
        httputils = require('./httputils.js'),
          connect = require('connect'),
        webfinger = require('./webfinger.js'),
         sessions = require('cookie-sessions'),
          secrets = require('./secrets.js');

const STATIC_DIR = path.join(path.dirname(__dirname), "static");

const COOKIE_SECRET = secrets.hydrateSecret('cookie_secret', __dirname);

exports.handler = function(request, response, serveFile) {
  // dispatch!
  var urlpath = url.parse(request.url).pathname;

  if (urlpath === '/sign_in') {
    serveFile(path.join(STATIC_DIR, "dialog", "index.html"), response);
  } else if (/^\/wsapi\/\w+$/.test(urlpath)) {
    try {
      var method = path.basename(urlpath);
      wsapi[method](request, response);
    } catch(e) {
      var errMsg = "oops, error executing wsapi method: " + method + " (" + e.toString() +")";
      console.log(errMsg);
      httputils.fourOhFour(response, errMsg);
    }
  } else if (/^\/users\/[^\/]+.xml$/.test(urlpath)) {
    var identity = path.basename(urlpath).replace(/.xml$/, '').replace(/^acct:/, '');

    webfinger.renderUserPage(identity, function (resultDocument) {
      if (resultDocument === undefined) {
        httputils.fourOhFour(response, "I don't know anything about: " + identity + "\n");
      } else {
        httputils.xmlResponse(response, resultDocument);
      }
    });
  } else if (urlpath === "/code_update") {
      console.log("code updated.  shutting down.");
      process.exit();
  } else {
    // node.js takes care of sanitizing the request path
    if (urlpath == "/") urlpath = "/index.html"
    serveFile(path.join(STATIC_DIR, urlpath), response);
  }
};

exports.setup = function(server) {
  var week = (7 * 24 * 60 * 60 * 1000);
  server.use(sessions({
      secret: COOKIE_SECRET,
      session_key: "primary_state",
      path: '/'
  }));
}
