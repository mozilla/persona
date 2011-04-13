// a module which implements the authorities web server api.
// every export is a function which is a WSAPI method handler

const    url = require('url'),
   httputils = require('./httputils.js')

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

exports.all_words = function(req,resp) {
  if (!isAuthed(req,resp)) return;
  httputils.serverError(resp, "notImplemented");
};

exports.add_word = function(req,resp) {
  if (!isAuthed(req,resp)) return;
  httputils.serverError(resp, "notImplemented");
};
