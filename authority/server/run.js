const path = require('path'),
       url = require('url'),
     wsapi = require('./wsapi.js'),
 httputils = require('./httputils.js');

const STATIC_DIR = path.join(path.dirname(__dirname), "static");

exports.handler = function(request, response, serveFile) {
  // dispatch!
  var urlpath = url.parse(request.url).pathname;

  if (urlpath === '/sign_in') {
    serveFile(path.join(STATIC_DIR, "dialog", "index.html"));
  } else if (/^\/wsapi\/\w+$/.test(urlpath)) {
    try {
      var method = path.basename(urlpath);
      wsapi[method](request, response);
    } catch(e) {
      var errMsg = "oops, error executing wsapi method: " + method + " (" + e.toString() +")";
      httputils.fourOhFour(response, errMsg);
      console.log(errMsg);
    }
  } else {
    // node.js takes care of sanitizing the request path
    serveFile(path.join(STATIC_DIR, urlpath));
  }
};
