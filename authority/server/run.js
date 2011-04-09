console.log("authority handler starting up!");

const path = require('path'),
       url = require('url'),
     wsapi = require('./wsapi.js');

const STATIC_DIR = path.join(path.dirname(__dirname), "static");

function fourOhFour(resp, reason) {
  resp.writeHead(404, {"Content-Type": "text/plain"});
  resp.write("404 Not Found");
  if (reason) {
    resp.write(": " + reason);
  }
  resp.end();
  return undefined;
}

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
      var errMsg = "oops, no such wsapi method: " + method + " (" + e.toString() +")";
      fourOhFour(response, errMsg);
      console.log(errMsg);
    }
  } else {
    // node.js takes care of sanitizing the request path
    serveFile(path.join(STATIC_DIR, urlpath));
  }
};

console.log("authority handler started!");
