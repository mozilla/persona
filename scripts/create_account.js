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
 *   Lloyd Hilaiel <lloyd@hilaiel.com>
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

const
wcli = require("../lib/wsapi_client.js");

var argv = require('optimist')
.usage('Stage a new account for creation, causing an email to be sent.\nUsage: $0')
.alias('h', 'help')
.describe('h', 'display this usage message')
.alias('s', 'server')
.describe('s', 'server url to stage on')
.default('s', 'https://browserid.org')
.alias('d', 'domain')
.describe('d', 'domain that email is staged on behalf of, will be in email body')
.default('d', "create_account_command_line_tool.com")
.alias('e', 'email')
.describe('e', 'email address to stage')
.demand('e');

var args = argv.argv;

// request context (cookie jar, etc)
var ctx = {};

if (args.h) {
  argv.showHelp();
  process.exit(0);
}

wcli.post({
  browserid: args.s
}, '/wsapi/stage_user', ctx, {
  email: args.e,
  site: args.d
}, function(err, response) {
  function doError(e) {
    process.stderr.write("error: " + e.toString() + "\n");
    process.stderr.write("response: " + response.body  + "\n");
    process.exit(1);
  }
  if (err) return doError(err);
  try {
    var body = JSON.parse(response.body);
    if (body.success !== true) {
      throw "request failed: " + response.body;
    }
  } catch(e) {
    return doError(e);
  }
});
