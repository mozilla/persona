#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
http = require('http'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js');

var suite = vows.describe('page requests');

// start up a pristine server
start_stop.addStartupBatches(suite);

// This set of tests check to make sure all of the expected pages are served
// up with the correct status codes.  We use Lloyd's wsapi client as our REST
// interface.


// Taken from the vows page.
function assertStatus(code) {
  return function (err, res) {
    assert.equal(res.code, code);
  };
}

function respondsWith(status) {
  var context = {
    topic: function () {
      // Get the current context's name, such as "POST /"
      // and split it at the space.
      var req    = this.context.name.split(/ +/), // ["POST", "/"]
          method = req[0].toLowerCase(),         // "post"
          path   = req[1];                       // "/"

      // Perform the contextual client request,
      // with the above method and path.
      wsapi[method](path).call(this);
    }
  };

  // Create and assign the vow to the context.
  // The description is generated from the expected status code
  // and the status name, from node's http module.
  context['should respond with a ' + status + ' '
         + http.STATUS_CODES[status]] = assertStatus(status);

  return context;
}

suite.addBatch({
  'GET /':                       respondsWith(200),
  'GET /signup':                 respondsWith(200),
  'GET /forgot':                 respondsWith(200),
  'GET /signin':                 respondsWith(200),
  'GET /about':                  respondsWith(200),
  'GET /tos':                    respondsWith(200),
  'GET /privacy':                respondsWith(200),
  'GET /verify_email_address':   respondsWith(200),
  'GET /add_email_address':      respondsWith(200),
  'GET /confirm':                respondsWith(200),
  'GET /reset_password':         respondsWith(200),
  'GET /confirm':                respondsWith(200),
  'GET /idp_auth_complete':      respondsWith(200),
  'GET /pk':                     respondsWith(200),
  'GET /.well-known/browserid':  respondsWith(200),
  'GET /signin':                 respondsWith(200),
  'GET /unsupported_dialog':     respondsWith(200),
  'GET /cookies_disabled':       respondsWith(200),
  'GET /developers':             respondsWith(200),
  'GET /developers':             respondsWith(302),
  'GET /developers/':            respondsWith(302),
  'GET /test':                   respondsWith(301),
  'GET /test/':                  respondsWith(200),
  'GET /include.js':             respondsWith(200),
  'GET /include.orig.js':        respondsWith(200)
});

// shut the server down and cleanup
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
