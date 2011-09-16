/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
