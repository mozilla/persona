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

const   path = require('path'),
         url = require('url'),
          fs = require('fs'),
   httputils = require('./lib/httputils.js'),
 idassertion = require('./lib/idassertion.js'),
         jwt = require('./lib/jwt.js'),
     express = require('express');
     metrics = require('../libs/metrics.js');

// create the var directory if it doesn't exist
var VAR_DIR = path.join(__dirname, "var");
try { fs.mkdirSync(VAR_DIR, 0755); } catch(e) { }

function doVerify(req, resp, next) {
  var assertion = (req.query && req.query.assertion) ? req.query.assertion : req.body.assertion;
  var audience = (req.query && req.query.audience) ? req.query.audience : req.body.audience;

  if (!(assertion && audience))
    return resp.json({ status: "failure", reason: "need assertion and audience" });

  // allow client side XHR to access this WSAPI, see
  // https://developer.mozilla.org/en/http_access_control
  // for details
  // FIXME: should we really allow this? It might encourage the wrong behavior
  resp.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    resp.setHeader('Access-Control-Allow-Methods', 'POST, GET');
    resp.writeHead(200);
    resp.end();
    return;
  }

  try {
    var assertionObj = new idassertion.IDAssertion(assertion);
    assertionObj
      .verify(
        audience,
        function(payload) {
          // log it!
          metrics.report('verify', {
            result: 'success',
            rp: payload.audience
          });
          
          result = {
            status : "okay",
            email : payload.email,
            audience : payload.audience,
            "valid-until" : payload["valid-until"],
            issuer : payload.issuer
          };
          resp.json(result);
        },
        function(errorObj) {
          metrics.report('verify', {
            result: 'failure',
            rp: audience
          });
          resp.json({ status: "failure", reason: errorObj });
        }
      );
  } catch (e) {
    console.log(e.stack);
    metrics.report('verify', {
      result: 'failure',
      rp: audience
    });
    resp.json({ status: "failure", reason: e.toString() });
  }
}

exports.varDir = VAR_DIR;

exports.setup = function(app) {
  app.use(express.bodyParser());

  // code_update is an internal api that causes the node server to
  // shut down.  This should never be externally accessible and
  // is used during the dead simple deployment procedure.
  app.get("/code_update", function (req, resp) {
    console.log("code updated.  shutting down.");
    process.exit();
  });

  // A simple ping hook for monitoring.
  app.get("/ping.txt", function(req ,resp) {
    resp.writeHead(200, {"Content-Type": "text/plain"})
    resp.write("k.");
    resp.end();
  });

  app.get('/', doVerify);
  app.get('/verify', doVerify);

  app.post('/', doVerify);
  app.post('/verify', doVerify);
};
