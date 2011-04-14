const httputils = require('./httputils.js'),
           http = require('http'),
            url = require('url'); 

exports.performVerfication = function(server, audience, req, resp) {
  console.log("performVerification called");

  var assertion = "";

  req.on('data', function(str) {
    assertion += str;
  });
  req.on('end', function() {
    console.log("Got assertion for verification: " + assertion);
    console.log("bouncing this off my verification server: " + server);

    serverParsed = url.parse(server);

    try {
      var req = http.request({
        host: serverParsed.hostname,
        port: serverParsed.port,
        path: '/wsapi/verify?assertion=' + encodeURIComponent(assertion) + "&audience=" + audience,
        method: 'GET'
      }, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          try {
            if (res.statusCode != 200) throw "bad status: " + res.statusCode;
            var response;
            try { response = JSON.parse(chunk); } catch(e) { throw "malformed json response body"; }
            if (response.status === 'failure') throw response.reason;
            else if (response.status === 'okay') {
              console.log("your identity is validated!");
              // extract email address and store it in session state
              httputils.serverError(resp, "not implemented");
            } else {
              throw "unknown response code: " + response.status;
            }
          } catch(e) {
            httputils.serverError(resp, "error verifying assertion: " + e);
          }
        });
      });
      // execute the request
      req.end();
    } catch(e) {
      console.log("request to verifier failed: " + e);
      httputils.serverError(resp, "verifierFailed");
    }
  });
};
