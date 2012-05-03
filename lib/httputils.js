/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// various little utilities to make crafting boilerplate responses
// simple

function sendResponse(resp, content, reason, code) {
  if (content) {
    if (reason) content += ": " + reason;
  } else if (reason) {
    content = reason;
  } else {
    content = "";
  }
  resp.send(content, {"Content-Type": "text/plain"}, code);
}

exports.notFound = function(resp, reason) {
  sendResponse(resp, "Not Found", reason, 404);
};

exports.serverError = function(resp, reason) {
  sendResponse(resp, "Server Error", reason, 500);
};

exports.serviceUnavailable = function(resp, reason) {
  sendResponse(resp, "Service Unavailable", reason, 503);
};

exports.authRequired = function(resp, reason) {
  sendResponse(resp, "Authentication Required", reason, 401);
};

exports.badRequest = function(resp, reason) {
  sendResponse(resp, "Bad Request", reason, 400);
};

exports.forbidden = function(resp, reason) {
  sendResponse(resp, "Forbidden", reason, 403);
};

exports.throttled = function(resp, reason) {
  sendResponse(resp, "Too Many Requests", reason, 429);
};
