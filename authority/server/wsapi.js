const db = require('./db.js'),
     url = require('url');

exports.have_email = function(req, resp) {
  // get inputs from get data!
  var email = url.parse(req.url, true).query['email'];

  var haveit = db.haveEmail(email);

  console.log("have_email for " + email + ": " + haveit);

  // 200 means we have the email, 404 means no
  resp.writeHead(haveit ? 200 : 404, {"Content-Type": "application/json"});
  resp.write(JSON.stringify(haveit));
  resp.end();
};