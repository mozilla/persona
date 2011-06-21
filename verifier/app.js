const   path = require('path'),
         url = require('url'),
          fs = require('fs'),
   httputils = require('./lib/httputils.js'),
 idassertion = require('./lib/idassertion.js'),
         jwt = require('./lib/jwt.js');

// create the var directory if it doesn't exist
var VAR_DIR = path.join(__dirname, "var");
try { fs.mkdirSync(VAR_DIR, 0755); } catch(e) { }

function handler(req, resp, serveFile) {
    // dispatch!
    var parsed = url.parse(req.url, true);

    var urlpath = parsed.pathname;

    // code_update is an internal api that causes the node server to
    // shut down.  This should never be externally accessible and
    // is used during the dead simple deployment.
    //
    // NOTE: this should be reworked as the project gets more serious.
    if (urlpath === "/code_update") {
        console.log("code updated.  shutting down.");
        process.exit();
    }

    // A simple ping hook for monitoring.
    else if (urlpath === "/ping.txt") {
        resp.writeHead(200, {"Content-Type": "text/plain"})
        resp.write("k.");
        resp.end();
    }

    // the verification API, the main reason this server exists!
    else {
        var assertion = parsed.query['assertion'];
        var audience = parsed.query['audience'];

        // allow client side XHR to access this WSAPI, see
        // https://developer.mozilla.org/en/http_access_control
        // for details
        resp.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') {
            resp.setHeader('Access-Control-Allow-Methods', 'GET');
            resp.writeHead(200);
            resp.end();
            return;
        }

        try {
            var assertionObj = new idassertion.IDAssertion(assertion);
            assertionObj.verify(
                audience,
                function(payload) {
                    result = {
                        status : "okay",
                        email : payload.email,
                        audience : payload.audience,
                        "valid-until" : payload["valid-until"],
                        issuer : payload.issuer
                    };
                    httputils.jsonResponse(resp, result);
                },
                function(errorObj) {
                    httputils.jsonResponse(resp, {status:"failure", reason:errorObj});
                }
            );
        } catch (e) {
            console.log(e.stack);
            httputils.jsonResponse(resp, {status:"failure", reason:e.toString()});
        }
    }
};

exports.varDir = VAR_DIR;

exports.setup = function(app) {
    app.use(handler);
};
