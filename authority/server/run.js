console.log("authority handler starting up!");

const path = require('path'); 

const STATIC_DIR = path.join(path.dirname(__dirname), "static");

exports.handler = function(request, response, serveFile) {
  // dispatch!
  console.log(request.url);

  if (request.url === '/sign_in') {
    serveFile(path.join(STATIC_DIR, "dialog", "index.html"));
  } else {
    // node.js takes care of sanitizing the request path
    serveFile(path.join(STATIC_DIR, request.url));
  }
};
