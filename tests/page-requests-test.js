#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
respondsWith = require('./lib/responds-with.js');

var suite = vows.describe('page requests');

process.env.PROXY_IDPS = JSON.stringify({
  "yahoo.com": "example.domain"
});

// start up a pristine server
start_stop.addStartupBatches(suite);

// This set of tests check to make sure all of the expected pages are served
// up with the correct status codes.

suite.addBatch({
  'GET /':                       respondsWith(200),
  'GET /about':                  respondsWith(200),
  'GET /en/tos':                 respondsWith(200),
  'GET /en/privacy':             respondsWith(200),
  'GET /verify_email_address':   respondsWith(200),
  'GET /add_email_address':      respondsWith(200),
  'GET /confirm':                respondsWith(200),
  'GET /reset_password':         respondsWith(200),
  'GET /pk':                     respondsWith(200),
  'GET /.well-known/browserid':  respondsWith(200),
  'GET /.well-known/browserid?domain=yahoo.com':
                                 respondsWith(200),
  'GET /unsupported_dialog':     respondsWith(200),
  'GET /unsupported_dialog_without_watch':
                                 respondsWith(200),
  'GET /cookies_disabled':       respondsWith(200),
  'GET /developers':             respondsWith(302),
  'GET /developers/':            respondsWith(302),
  'GET /signup':                 respondsWith(301),
  'GET /signup/':                respondsWith(301),
  'GET /signin':                 respondsWith(301),
  'GET /signin/':                respondsWith(301),
  'GET /forgot':                 respondsWith(301),
  'GET /forgot/':                respondsWith(301),
  'GET /test':                   respondsWith(301),
  'GET /test/':                  respondsWith(200),
  'GET /include.js':             respondsWith(200),
  'GET /include.orig.js':        respondsWith(200),
  'GET /provisioning_api.js':    respondsWith(200),
  'GET /provisioning_api.orig.js':
                                 respondsWith(200),
  'GET /authentication_api.js':  respondsWith(200),
  'GET /authentication_api.orig.js':
                                 respondsWith(200),
  'GET /humans.txt':             respondsWith(200),
  'GET /build/code_version.js':  respondsWith(200),
  'GET /%e3h':                   respondsWith(404)
});

// shut the server down and cleanup
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
