// a module which implements the authorities web server api.
// every export is a function which is a WSAPI method handler

const     db = require('./db.js'),
         url = require('url'),
   httputils = require('./httputils.js');
       email = require('./email.js');

function logRequest(method, args) {
  console.log("WSAPI ("+method+") " + (args ? JSON.stringify(args) : "")); 
}

function checkParams(getArgs, resp, params) {
  try {
    params.forEach(function(k) {
      if (!getArgs.hasOwnProperty(k) || typeof getArgs[k] !== 'string') {
        throw k;
      }
    });
  } catch(e) {
    httputils.badRequest(resp, "missing '" + e + "' argument");
    return false;
  }
  return true;
}

function isAuthed(req, resp) {
  if (typeof req.session.authenticatedUser !== 'string') {
    httputils.badRequest(resp, "requires authentication");
    return false;
  }
  return true;
}

/* checks to see if an email address is known to the server
 * takes 'email' as a GET argument */
exports.have_email = function(req, resp) {
  // get inputs from get data!
  var email = url.parse(req.url, true).query['email'];
  logRequest("have_email", {email: email});
  httputils.jsonResponse(resp, undefined != db.findByEmail(email));
};

/* First half of account creation.  Stages a user account for creation.
 * this involves creating a secret url that must be delivered to the
 * user via their claimed email address.  Upon timeout expiry OR clickthrough
 * the staged user account transitions to a valid user account */
exports.stage_user = function(req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (!checkParams(getArgs, resp, [ "email", "pass", "pubkey" ])) return;

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
  if (undefined != db.findByEmail(email)) {
    delete req.session.pendingRegistration;
    req.session.authenticatedUser = email;
    httputils.jsonResponse(resp, "complete");
  } else if (db.isStaged(email)) {
    httputils.jsonResponse(resp, "pending");
  } else {
    httputils.jsonResponse(resp, "noRegistration");
  }
};

exports.authenticate_user = function(req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (!checkParams(getArgs, resp, [ "email", "pass" ])) return;

  if (db.checkAuth(getArgs.email, getArgs.pass)) {
    req.session.authenticatedUser = getArgs.email;
    httputils.jsonResponse(resp, true);      
  } else {
    httputils.jsonResponse(resp, false);      
  }
};

exports.add_email = function (req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (!checkParams(getArgs, resp, [ "email", "pubkey" ])) return;

  if (!isAuthed(req, resp)) return;

  logRequest("add_email", getArgs);

  try {
    // upon success, stage_user returns a secret (that'll get baked into a url
    // and given to the user), on failure it throws
    var secret = db.stageEmail(req.session.authenticatedUser, getArgs.email, getArgs.pubkey);
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

exports.set_key = function (req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;
  if (!checkParams(getArgs, resp, [ "email", "pubkey" ])) return;
  if (!isAuthed(req, resp)) return;
  logRequest("set_key", getArgs);
  db.addEmailToAccount(req.session.authenticatedUser, getArgs.email, getArgs.pubkey);
  httputils.jsonResponse(resp, true);
};

exports.am_authed = function(req,resp) {
  logRequest("am_authed", req.session);
  httputils.jsonResponse(resp, (typeof req.session.authenticatedUser === 'string'));
};

exports.sync_emails = function(req,resp) {
  if (!isAuthed(req, resp)) return;

  var requestBody = "";
  req.on('data', function(str) {
    requestBody += str;
  });
  req.on('end', function() {
    logRequest("sync_emails", requestBody);
    try {
      var emails = JSON.parse(requestBody);
      var syncResponse = db.getSyncResponse(req.session.authenticatedUser, emails);
      httputils.jsonResponse(resp, syncResponse);
    } catch(e) {
      httputils.badRequest(resp, "malformed payload: " + e);
    }
  });
};
