#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
wcli = require("../lib/wsapi_client.js"),
jwcrypto = require('jwcrypto');
require("jwcrypto/lib/algs/ds");

var argv = require('optimist')
.usage('Given a username, password, and audience, get an assertion.\nUsage: $0')
.alias('h', 'help')
.describe('h', 'display this usage message')
.alias('s', 'server')
.describe('s', 'persona server url')
.default('s', 'https://login.persona.org')
.alias('a', 'audience')
.describe('a', 'the domain to which the assertion should be targeted')
.default('a', "example.com")
.alias('e', 'email')
.describe('e', 'email address')
.demand('e')
.alias('p', 'password')
.describe('p', 'persona password associated with email address')
.demand('p');

var args = argv.argv;

// request context (cookie jar, etc)
var ctx = {};

if (args.h) {
  argv.showHelp();
  process.exit(0);
}

var serverURL = {
  browserid: args.s
};

// first we'll authenticate to the server.  Note, inside wcli the
// library will call /wsapi/session_context to get a valid CSRF
// token
wcli.post(serverURL, '/wsapi/authenticate_user', ctx, {
  email: args.e,
  pass: args.p,
  ephemeral: false
}, function(err, response) {
  function handleErr(err) {
    process.stderr.write("error authenticating: " + err + "\n")
    process.exit(1);
  }
  if (err) handleErr(err);
  response = JSON.parse(response.body);
  if (!response.success) handleErr(response.reason);

  // now we have an authenticated session, A cookie was returned from the
  // server that will be sent in subsequent requests.  the wclient library
  // pulled it out and put it in our 'ctx' var.
  // Now let's generate a keypair
  jwcrypto.generateKeypair({algorithm: "DS", keysize: 256}, function(err, kp) {
    if (err) {
      process.stderr.write("error generating keypair: " + err + "\n")
      process.exit(1);
    }
    // now with our authenticated session we can pass up the public key to
    // generate a certificate signed by login.persona.org
    wcli.post(serverURL, '/wsapi/cert_key', ctx, {
      email: args.e,
      pubkey: kp.publicKey.serialize(),
      ephemeral: false
    }, function(err, r) {
      if (err) {
        process.stderr.write("error certifying key: " + err + "\n")
        process.exit(1);
      }
      // NOTE!  this certificate is valid for a while.  we can re-use it to
      // generate multiple assertions for multiple different domains.  For
      // the purposes of this script, let's generate a signle assertion and
      // exit!
      var cert = r.body.toString();
      // expires in a couple minutes
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));      
      jwcrypto.assertion.sign(
        {}, {audience: args.a, expiresAt: expirationDate},
        kp.secretKey, function(err, assertion) {
          if (err) return self.callback(err);
          var b = jwcrypto.cert.bundle([cert], assertion);
          console.log(b);
        });
    });
  });
});
