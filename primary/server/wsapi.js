// a module which implements the primary authority web server api.
// every export is a function which is a WSAPI method handler

const     db = require('./db.js'),
         url = require('url'),
   httputils = require('./httputils.js');

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

function isAuthed(req) {
  return (req.session && typeof req.session.userid === 'number');
}

function checkAuthed(req, resp) {
  if (!isAuthed(req)) {
    httputils.badRequest(resp, "requires authentication");
    return false;
  }
  return true;
}

/* checks to see if a username address is known to the server
 * takes 'username' as a GET argument */
exports.username_available = function(req, resp) {
  // get inputs from get data!
  var username = url.parse(req.url, true).query['username'];
  logRequest("username_available", {username: username});
  db.usernameKnown(username, function(known) { 
    httputils.jsonResponse(resp, known);
  });
};

/* Account creation.  Takes a username and password and puts it
 * into the database. */
exports.create_user = function(req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (!checkParams(getArgs, resp, [ "username", "pass" ])) return;

  logRequest("create_user", getArgs);

  try {
    db.create_user(getArgs["username"], getArgs["pass"], function(error) {
      if (error) {
        logRequest("create_user", error);
        httputils.jsonResponse(resp, undefined);
      } else {
        if (!req.session) req.session = {};
        db.usernameToUserID(getArgs.username, function(userid) {
          req.session.userid = userid;
          httputils.jsonResponse(resp, userid);
        });
      }
    });
  } catch(e) {
    // we should differentiate tween' 400 and 500 here.
    httputils.badRequest(resp, e.toString());
  }
};

exports.authenticate_user = function(req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  logRequest("authenticate_user", getArgs);
  if (!checkParams(getArgs, resp, [ "username", "pass" ])) return;

  db.checkAuth(getArgs.username, getArgs.pass, function(userid) {
    logRequest("authenticate_user", "login attempt status: " + userid);
    if (userid) {
      if (!req.session) req.session = {};
      req.session.userid = userid;
    }
    var rp = {username: getArgs.username, status: userid != null};
    httputils.jsonResponse(resp, rp);
  });
};

exports.signout = function(req, resp) {

  if (req.session) {
    req.session.userid = undefined;// can I reference undefined safely like this?
  }
  httputils.jsonResponse(resp, {});
};

exports.add_key = function (req, resp) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (!checkParams(getArgs, resp, [ "pubkey" ])) {
    logRequest("add_key", "Missing required pubkey");
    return;
  }
  if (!checkAuthed(req, resp)) {
    logRequest("add_key", "Not authed - req.session is " + req.session);
    return;
  }

  logRequest("add_key", getArgs);
  db.addKeyToAccount(req.session.userid, getArgs.pubkey, function (rv) {
    logRequest("add_key", "Success");
    httputils.jsonResponse(resp, rv);
  });
};

exports.am_authed = function(req,resp) {
  logRequest("am_authed", req.session);
  httputils.jsonResponse(resp, isAuthed(req));
};

exports.current_username = function(req,resp) {
  logRequest("current_username", req.session);
  try {
    if (isAuthed(req)) {
      logRequest("current_username", "isAuthed");
      db.userIDToUsername(req.session.userid, function(username) {
        if (username !== undefined) {
          logRequest("current_username", username);
          httputils.jsonResponse(resp, username);
        } else {
          logRequest("current_username", "userid doesn't exist: " + req.session.userid);
          req.session.userid = undefined;
          httputils.jsonResponse(resp, false);
        }
      });
    } else {
      logRequest("current_username", "notAuthed");
      httputils.jsonResponse(resp, false);
    }
  } catch (e) {
    console.log(e);
  }
};

