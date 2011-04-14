// a module which implements the authorities web server api.
// every export is a function which is a WSAPI method handler

const      url = require('url'),
     httputils = require('./httputils.js'),
   idassertion = require('./idassertion.js');
   jwt         = require('./jwt.js');

function logRequest(method, args) {
  console.log("WSAPI ("+method+") " + (args ? JSON.stringify(args) : "")); 
}

/* verifies an identity assertion.
 * takes 'assertion' and 'audience' as GET arguments 
 *
 * XX should be POST
 */
exports.verify = function(req, resp) {
  // get inputs from get data!
  var parsed = url.parse(req.url, true);
  var assertion = parsed.query['assertion'];
  var audience = parsed.query['audience'];

  logRequest("verify", {assertion: assertion, audience:audience});

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
    assertionObj.verify(audience, 
      function(successObj) {
        httputils.jsonResponse(resp, {status:"okay"});
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

