// a module which implements the authorities web server api.
// every export is a function which is a WSAPI method handler

const db = require('./db.js'),
      url = require('url'),
      httputils = require('./httputils.js');
      email = require('./email.js'),
      crypto = require('crypto');   

// md5 is used to obfuscate passwords simply so we don't store
// users passwords in plaintext anywhere
function obfuscatePassword(pass) {
  var hash = crypto.createHash('sha256');
  hash.update(pass);
  return hash.digest('base64');
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

function isAuthed(req) {
  return (req.session && typeof req.session.authenticatedUser === 'string');
}

function checkAuthed(req, resp) {
  if (!isAuthed(req)) {
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
  db.emailKnown(email, function(known) {
    httputils.jsonResponse(resp, known);
  });
};

/* First half of account creation.  Stages a user account for creation.
 * this involves creating a secret url that must be delivered to the
 * user via their claimed email address.  Upon timeout expiry OR clickthrough
 * the staged user account transitions to a valid user account */
exports.stage_user = function(req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (!checkParams(getArgs, resp, [ "email", "pass", "pubkey", "site" ])) {
    return;
  }

  getArgs.pass = obfuscatePassword(getArgs.pass);

  try {
    // upon success, stage_user returns a secret (that'll get baked into a url
    // and given to the user), on failure it throws
    var secret = db.stageUser(getArgs);

    // store the email being registered in the session data
    if (!req.session) req.session = {};
    req.session.pendingRegistration = getArgs.email;

    httputils.jsonResponse(resp, true);

    // let's now kick out a verification email!
    email.sendVerificationEmail(getArgs.email, getArgs.site, secret);

  } catch(e) {
    // we should differentiate tween' 400 and 500 here.
    httputils.badRequest(resp, e.toString());
  }
};

exports.registration_status = function(req, resp) {
  if (!req.session || !(typeof req.session.pendingRegistration === 'string')) {
    httputils.badRequest(
      resp,
      "api abuse: registration_status called without a pending email for registration");
    return;
  }

  var email = req.session.pendingRegistration;
  db.emailKnown(email, function(known) {
    if (known) {
      delete req.session.pendingRegistration;
      req.session.authenticatedUser = email;
      httputils.jsonResponse(resp, "complete");
    } else if (db.isStaged(email)) {
      httputils.jsonResponse(resp, "pending");
    } else {
      httputils.jsonResponse(resp, "noRegistration");
    }
  });
};

exports.authenticate_user = function(req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (!checkParams(getArgs, resp, [ "email", "pass" ])) return;

  getArgs.pass = obfuscatePassword(getArgs.pass);

  db.checkAuth(getArgs.email, getArgs.pass, function(rv) {
    if (rv) {
      if (!req.session) req.session = {};
      req.session.authenticatedUser = getArgs.email;
    }
    httputils.jsonResponse(resp, rv);
  });
};

// need CSRF protection

exports.add_email = function (req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (!checkParams(getArgs, resp, [ "email", "pubkey", "site" ])) return;

  if (!checkAuthed(req, resp)) return;

  try {
    // upon success, stage_user returns a secret (that'll get baked into a url
    // and given to the user), on failure it throws
    var secret = db.stageEmail(req.session.authenticatedUser, getArgs.email, getArgs.pubkey);

    // store the email being registered in the session data
    req.session.pendingRegistration = getArgs.email;

    httputils.jsonResponse(resp, true);

    // let's now kick out a verification email!
    email.sendVerificationEmail(getArgs.email, getArgs.site, secret);
  } catch(e) {
    // we should differentiate tween' 400 and 500 here.
    httputils.badRequest(resp, e.toString());
  }
};

exports.remove_email = function(req, resp) {
  // this should really be POST, but for now I'm having trouble seeing
  // how to get POST args properly, so it's a GET (Ben).
  // hmmm, I really want express or some other web framework!
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (!checkParams(getArgs, resp, [ "email"])) return;
  if (!checkAuthed(req, resp)) return;

  db.removeEmail(req.session.authenticatedUser, getArgs.email, function(error) {
    if (error) {
      console.log("error removing email " + getArgs.email);
      httputils.badRequest(resp, error.toString());
    } else {
      httputils.jsonResponse(resp, true);
    }});
};

exports.account_cancel = function(req, resp) {
  // this should really be POST
  if (!checkAuthed(req, resp)) return;

  db.cancelAccount(req.session.authenticatedUser, function(error) {
    if (error) {
      console.log("error cancelling account : " + error.toString());
      httputils.badRequest(resp, error.toString());
    } else {
      httputils.jsonResponse(resp, true);
    }});
};

exports.set_key = function (req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;
  if (!checkParams(getArgs, resp, [ "email", "pubkey" ])) return;
  if (!checkAuthed(req, resp)) return;
  db.addKeyToEmail(req.session.authenticatedUser, getArgs.email, getArgs.pubkey, function (rv) {
    httputils.jsonResponse(resp, rv);
  });
};

exports.am_authed = function(req,resp) {
  // if they're authenticated for an email address that we don't know about,
  // then we should purge the stored cookie
  if (!isAuthed(req)) {
    httputils.jsonResponse(resp, false);
  } else {
    db.emailKnown(req.session.authenticatedUser, function (known) {
      if (!known) req.session = {}
      httputils.jsonResponse(resp, known);
    });
  }
};

exports.logout = function(req,resp) {
  req.session = {};
  httputils.jsonResponse(resp, "ok");
};

exports.sync_emails = function(req,resp) {
  if (!checkAuthed(req, resp)) return;

  var requestBody = "";
  req.on('data', function(str) {
    requestBody += str;
  });
  req.on('end', function() {
    try {
      var emails = JSON.parse(requestBody);
    } catch(e) {
      httputils.badRequest(resp, "malformed payload: " + e);
    }
    db.getSyncResponse(req.session.authenticatedUser, emails, function(err, syncResponse) {
      if (err) httputils.serverError(resp, err);
      else httputils.jsonResponse(resp, syncResponse);
    });
  });
};

exports.prove_email_ownership = function(req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  // validate inputs
  if (!checkParams(getArgs, resp, [ "token" ])) return;

  db.gotVerificationSecret(getArgs.token, function(e) {
    if (e) {
      console.log("error completing the verification: " + e);
      httputils.jsonResponse(resp, false);
    } else {
      httputils.jsonResponse(resp, true);
    }
  });
}
