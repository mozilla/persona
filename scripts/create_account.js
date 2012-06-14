#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
wcli = require("../lib/wsapi_client.js");

var argv = require('optimist')
.usage('Stage a new account for creation, causing an email to be sent.\nUsage: $0')
.alias('h', 'help')
.describe('h', 'display this usage message')
.alias('s', 'server')
.describe('s', 'server url to stage on')
.default('s', 'https://login.persona.org')
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
