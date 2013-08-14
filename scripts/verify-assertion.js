#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
wcli = require("../lib/wsapi_client.js"),
jwcrypto = require('jwcrypto'),
assert = require('assert'),
https = require('https'),
querystring = require('querystring'),
urlparse = require('urlparse');

require("jwcrypto/lib/algs/ds");

var argv = require('optimist')
.usage('Given a username, password, and audience, get an assertion.\nUsage: $0')
.alias('h', 'help')
.describe('h', 'display this usage message')
.alias('s', 'server')
.describe('s', 'persona server url')
.default('s', 'https://login.anosrep.org')
.alias('v', 'verifier')
.describe('v', 'persona verifier url')
.default('v', 'https://verifier.login.anosrep.org')
.alias('a', 'audience')
.describe('a', 'the domain to which the assertion should be targeted')
.default('a', "http://testrp.example.com")
.alias('e', 'email')
.describe('e', 'email address')
.demand('e')
.alias('p', 'password')
.describe('p', 'persona password associated with email address')
.demand('p');

var args = argv.argv;
if (args.h) {
  argv.showHelp();
  process.exit(0);
}

// request context (cookie jar, etc)
var ctx = {};
var serverURL = { browserid: args.s };

function handleErr(err, msg) {
  msg = msg ? (' - ' + msg) : '';
  process.stderr.write(err + msg + '\n');
  process.exit(1);
}

// first we'll authenticate to the server.  Note, inside wcli the
// library will call /wsapi/session_context to get a valid CSRF
// token
wcli.post(serverURL, '/wsapi/authenticate_user', ctx, {
  email: args.e,
  pass: args.p,
  ephemeral: false
}, function(err, response) {
  if (err) return handleErr(err);

  response = JSON.parse(response.body);
  if (!response.success) return handleErr(response.reason);

  // now we have an authenticated session, A cookie was returned from the
  // server that will be sent in subsequent requests.  the wclient library
  // pulled it out and put it in our 'ctx' var.
  // Now let's generate a keypair
  jwcrypto.generateKeypair({algorithm: "DS", keysize: 128}, function(err, kp) {
    if (err) return handleErr(err);

    // now with our authenticated session we can pass up the public key to
    // generate a certificate signed by login.persona.org
    wcli.post(serverURL, '/wsapi/cert_key', ctx, {
      email: args.e,
      pubkey: kp.publicKey.serialize(),
      ephemeral: false
    }, function(err, r) {
      if (err) return handleErr(err);

      // NOTE!  this certificate is valid for a while.  we can re-use it to
      // generate multiple assertions for multiple different domains.
      var cert = r.body.toString();

      // Okay, now generate an assertion, and then post it to the verifier.
      // This assertion will expire in a couple minutes.
      var expirationDate = new Date(new Date().getTime() + (2 * 60 * 1000));
      var params = { audience: args.a, expiresAt: expirationDate };
      jwcrypto.assertion.sign({}, params, kp.secretKey, function(err, assertion) {
        if (err) return handleErr(err);

        var bundle = jwcrypto.cert.bundle([cert], assertion);
        //console.log(bundle);

        // We're acting like an RP now, so we'll use a regular http post with
        // no accumulated state (i.e., not use wcli again).
        postToVerifier(args.a, bundle, args.v, function(err, res) {
          if (err) {
            console.log(err);
            process.exit(1);
          }

          console.log('Received a response from the verifier');
          console.dir(res);

          assert.strictEqual(res.status, 'okay', 'status is okay');
          assert.strictEqual(res.email, args.e, 'email matches');
          assert.strictEqual(res.audience, args.a, 'audience matches');
          assert.strictEqual(res.issuer, urlparse(args.s).host, 'issuer matches');
          assert.ok(res.expires.toString().match(/^\d{13}$/), 'expires is epoch');
          assert.ok(res.expires - Date.now() > 0, 'expires in the future'); 

          console.log('verification was successful');
        });
      });
    });
  });
});

function postToVerifier(audience, bundle, verifier, callback) {
  var hostname = urlparse(verifier).host;

  var postBody = querystring.stringify({
    audience: audience,
    assertion: bundle
  });        
          
  var options = {
    hostname: hostname,
    path: '/verify',
    method: 'POST',
    rejectUnauthorized: true,
    agent: false,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': Buffer.byteLength(postBody)
    }
  };

  var req = https.request(options, function(res) {
    if (res.statusCode !== 200) {
      var msg = 'response is not 200 OK ' + res.statusCode;
      return callback(msg);
    }

    var body = '';
    res.setEncoding('utf8');
    res.on('data', function (chunk) { body += chunk; });

    res.on('end', function() {
      try { 
        body = JSON.parse(body);
      } catch(e) {
        return callback(e);
      }
      return callback(null, body);
    });
  });

  req.on('error', function(e) {
    return callback(e);
  });

  req.write(postBody);
  req.end();
}
