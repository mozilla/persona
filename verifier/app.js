const   path = require('path'),
         url = require('url'),
          fs = require('fs'),
   httputils = require('./lib/httputils.js'),
 idassertion = require('./lib/idassertion.js'),
         jwt = require('./lib/jwt.js'),
     express = require('express');
     logging = require('../libs/logging.js');

// create the var directory if it doesn't exist
var VAR_DIR = path.join(__dirname, "var");
try { fs.mkdirSync(VAR_DIR, 0755); } catch(e) { }

function doVerify(req, resp, next) {
  var assertion = (req.query && req.query.assertion) ? req.query.assertion : req.body.assertion;
  var audience = (req.query && req.query.audience) ? req.query.audience : req.body.audience;

  if (!(assertion && audience))
    return resp.json({ status: "failure", reason: "need assertion and audience" });

  // allow client side XHR to access this WSAPI, see
  // https://developer.mozilla.org/en/http_access_control
  // for details
  // FIXME: should we really allow this? It might encourage the wrong behavior
  resp.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    resp.setHeader('Access-Control-Allow-Methods', 'POST, GET');
    resp.writeHead(200);
    resp.end();
    return;
  }

  try {
    var assertionObj = new idassertion.IDAssertion(assertion);
    assertionObj
      .verify(
        audience,
        function(payload) {
          // log it!
          logging.log('verifier', {
              type: 'verify',
                result: 'success',
                rp: payload.audience
            });
          
          result = {
            status : "okay",
            email : payload.email,
            audience : payload.audience,
            "valid-until" : payload["valid-until"],
            issuer : payload.issuer
          };
          resp.json(result);
        },
        function(errorObj) {
          logging.log('verifier', {
              type: 'verify',
                result: 'failure',
                rp: audience
            });
          resp.json({ status: "failure", reason: errorObj });
        }
      );
  } catch (e) {
    console.log(e.stack);
    logging.log('verifier', {
        type: 'verify',
          result: 'failure',
          rp: audience
          });
    resp.json({ status: "failure", reason: e.toString() });
  }
}

exports.varDir = VAR_DIR;

exports.setup = function(app) {
  app.use(express.bodyParser());

  // code_update is an internal api that causes the node server to
  // shut down.  This should never be externally accessible and
  // is used during the dead simple deployment procedure.
  app.get("/code_update", function (req, resp) {
    console.log("code updated.  shutting down.");
    process.exit();
  });

  // A simple ping hook for monitoring.
  app.get("/ping.txt", function(req ,resp) {
    resp.writeHead(200, {"Content-Type": "text/plain"})
    resp.write("k.");
    resp.end();
  });

  app.get('/', doVerify);
  app.get('/verify', doVerify);

  app.post('/', doVerify);
  app.post('/verify', doVerify);
};
