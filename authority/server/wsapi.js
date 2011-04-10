// a module which implements the authorities web server api.
// every export is a function which is a WSAPI method handler

const     db = require('./db.js'),
         url = require('url'),
   httputils = require('./httputils.js');
       email = require('./email.js');

function logRequest(method, args) {
  console.log("WSAPI ("+method+") " + (args ? JSON.stringify(args) : "")); 
}

/* checks to see if an email address is known to the server
 * takes 'email' as a GET argument */
exports.have_email = function(req, resp) {
  // get inputs from get data!
  var email = url.parse(req.url, true).query['email'];
  logRequest("have_email", {email: email});
  httputils.jsonResponse(resp, db.haveEmail(email));
};

/* First half of account creation.  Stages a user account for creation.
 * this involves creating a secret url that must be delivered to the
 * user via their claimed email address.  Upon timeout expiry OR clickthrough
 * the staged user account transitions to a valid user account */
exports.stage_user = function(req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  try {
    [ "email", "pass", "pubkey" ].forEach(function(k) {
      if (!getArgs.hasOwnProperty(k) || typeof getArgs[k] !== 'string') {
        throw k;
      }
    });
  } catch(e) {
    httputils.badRequest(resp, "missing '" + e + "' argument");
    return;
  }

  logRequest("stage_user", getArgs);

  try {
    // upon success, stage_user returns a secret (that'll get baked into a url
    // and given to the user), on failure it throws
    var secret = db.stageUser(getArgs);
    httputils.jsonResponse(resp, true);

    // store the email being registered in the session data
    req.session.pendingRegistration = getArgs.email;

    // let's now kick out a verification email!
    email.sendVerificationEmail(getArgs.email, secret);
  } catch(e) {
    // we should differentiate tween' 400 and 500 here.
    httputils.badRequest(resp, e.toString());
  }
};

exports.registration_status = function(req, resp) {
  logRequest("registration_status", req.session);

  var email = req.session.pendingRegistration;
  if (db.haveEmail(email)) {
    httputils.jsonResponse(resp, "complete");      
  } else if (db.isStaged(email)) {
    httputils.jsonResponse(resp, "pending");      
  } else {
    httputils.jsonResponse(resp, "noRegistration");
  }
};
