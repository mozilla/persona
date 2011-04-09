const db = require('./db.js'),
     url = require('url');

exports.have_email = function(req, resp) {
  // get inputs from get data!
  var email = url.parse(req.url, true).query['email'];

  var haveit = db.haveEmail(email);

  console.log("have_email for " + email + ": " + haveit);

  resp.writeHead(200, {"Content-Type": "application/json"});
  resp.write(JSON.stringify(haveit));
  resp.end();
};