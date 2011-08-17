#!/usr/bin/env node

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

var  path = require("path"),
fs = require("fs"),
express = require("express"),
logger = require("../libs/logging.js").logger;

const amMain = (process.argv[1] === __filename);

const PRIMARY_HOST = "127.0.0.1";
const PRIMARY_PORT = 62700;

var handler = require("./app.js");

var app = undefined;

exports.runServer = function() {
  if (app) return;

  app = express.createServer();

  app.use(express.logger({
    stream: fs.createWriteStream(path.join(handler.varDir, "server.log"))
  }));

  // let the specific server interact directly with the connect server to register their middleware
  if (handler.setup) handler.setup(app);

  // use the express 'static' middleware for serving of static files (cache headers, HTTP range, etc)
  app.use(express.static(path.join(__dirname, "static")));

  app.listen(PRIMARY_PORT, PRIMARY_HOST);
};

exports.stopServer = function(cb) {
  if (!app) return;
  app.on('close', function() {
    cb();
  });
  app.close();
  app = undefined;
}

// when directly invoked from the command line, we'll start the server
if (amMain) exports.runServer();

