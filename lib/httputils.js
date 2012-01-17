/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// various little utilities to make crafting boilerplate responses
// simple

exports.fourOhFour = function(resp, reason)
{
  resp.writeHead(404, {"Content-Type": "text/plain"});
  resp.write("Not Found");
  if (reason) {
    resp.write(": " + reason);
  }
  resp.end();
};

exports.serverError = function(resp, reason)
{
  resp.writeHead(500, {"Content-Type": "text/plain"});
  if (reason) resp.write(reason);
  resp.end();
};

exports.badRequest = function(resp, reason)
{
  resp.writeHead(400, {"Content-Type": "text/plain"});
  resp.write("Bad Request");
  if (reason) {
    resp.write(": " + reason);
  }
  resp.end();
};

exports.forbidden = function(resp, reason)
{
  resp.writeHead(403, {"Content-Type": "text/plain"});
  resp.write("Forbidden");
  if (reason) {
    resp.write(": " + reason);
  }
  resp.end();
};

exports.jsonResponse = function(resp, obj)
{
  resp.writeHead(200, {"Content-Type": "application/json"});
  if (obj !== undefined) resp.write(JSON.stringify(obj));
  resp.end();
};

exports.xmlResponse = function(resp, doc)
{
  resp.writeHead(200, {"Content-Type": "text/xml"});
  if (doc !== undefined) resp.write(doc);
  resp.end();
};
