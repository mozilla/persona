/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Metrics middleware that reports when the signin dialog is opened.
 */

const urlparse = require('urlparse');
const _ = require('underscore');
const logger = require("../logging").logger;


// utility function to log a bunch of stuff at user entry point
module.exports = function(req, res, next) {
  // NOTE - this only counts the first time the user sees the dialog, it does
  // not count if the user returns from a primary. req.url will be
  // /sign_in?AUTH_RETURN or /sign_in?AUTH_RETURN_CANCEL for users who are
  // returning from their IdP.
  if (req.url === '/sign_in')
    signInEntry(req);
  else if (req.url === '/sign_in?AUTH_RETURN')
    idpAuthReturnEntry('idp.auth_return', req);
  else if (req.url === '/sign_in?AUTH_RETURN_CANCEL')
    idpAuthReturnEntry('idp.auth_cancel', req);

  next();
};

function signInEntry(req) {
  entry('signin', req, { rp: getReferer(req) });
}

function idpAuthReturnEntry(type, req) {
  entry(type, req, { idp: getReferer(req) });
}

function entry(type, req, data) {
  logger.info(type, _.extend({
    browser: req.headers['user-agent'],
    // IP address (this probably needs to be replaced with the
    // X-forwarded-for value
    ip: getIpAddress(req)
  }, data));
}

function getIpAddress(req) {
  var ipAddress = req.connection.remoteAddress;
  if (req.headers['x-real-ip']) ipAddress = req.headers['x-real-ip'];
  return ipAddress;
}

function getReferer(req) {
  var referer = null;
  try {
    // don't log more than we need
    referer = urlparse(req.headers.referer).originOnly().toString();
  } catch(e) {
    // ignore malformed referrers.  just log null
  }

  return referer;
}
