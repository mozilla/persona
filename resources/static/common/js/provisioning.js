/*jshint browser: true, forin: true, laxbreak: true */
/*global BrowserID: true, _: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Provisioning = (function() {
  "use strict";

  var jwcrypto = require("./lib/jwcrypto");
  var MAX_TIMEOUT = 20000; // 20s

  var Provisioning = function(args, successCB, failureCB) {
    var timeoutID;

    function tearDown() {
      if (timeoutID) timeoutID = clearTimeout(timeoutID);
      if (chan) chan.destroy();
      chan = undefined;
      if (iframe) document.body.removeChild(iframe);
      iframe = undefined;
    }

    function fail(code, msg) {
      tearDown();
      return setTimeout(function() {
        failureCB({
          code: code,
          msg: msg
        });
      }, 0);
    }

    if (!failureCB) throw "missing required failure callback";

    if (!args || !args.email || !args.url || !args.hasOwnProperty('ephemeral')) {
      return fail('internal', 'missing required arguments');
    }

    // extract the expected origin from the provisioning url
    // (this may be a different domain than the email domain part, if the
    //  domain delates authority)
    var origin;
    try {
      origin = /^(https?:\/\/[^\/]+)\//.exec(args.url)[1];
    } catch(e) { alert(e); }
    if (!origin) {
      return fail('internal', 'bad provisioning url, can\'t extract origin');
    }

    // time to attempt to provision the user.  we'll embed a hidden iframe from the
    // primary
    var iframe = document.createElement("iframe");
    iframe.setAttribute('src', args.url);
    iframe.style.display = "none";

    // start the timeout once the iframe loads, so we don't get false
    // positives if the user is on a slow connection.
    // the timeout should only happen if the provisioning site doesn't
    // want to provision for us.
    // see https://github.com/mozilla/browserid/pull/1954
    function iframeOnLoad() {
      if (timeoutID) {
        clearTimeout(timeoutID);
      }
      // a timeout for the amount of time that provisioning is allowed to take
      timeoutID = setTimeout(function provisionTimedOut() {
        fail('timeoutError', 'Provisioning timed out.');
      }, MAX_TIMEOUT);
    }

    if (iframe.addEventListener) {
      iframe.addEventListener('load', iframeOnLoad, false);
    } else if (iframe.attachEvent) {
      iframe.attachEvent('onload', iframeOnLoad);
    }
    // else ruh-roh?

    document.body.appendChild(iframe);

    var chan = Channel.build({
      window: iframe.contentWindow,
      origin: origin,
      scope: "vep_prov"
    });

    var keypair;

    // register handlers for different messages that the provisioning iframe will send
    chan.bind('beginProvisioning', function(trans, s) {
      return {
        email: args.email,
        // XXX: {non,}ephemeral auth duration should be stored somewhere central and
        // should be common between primary and secondary cert provisioning.  Because
        // the latter occurs on the server, it should probably be sent session_context.
        cert_duration_s: ((args.ephemeral === false) ? (6 * 60 * 60) : (60 * 60))
      };
    });

    chan.bind('genKeyPair', function(trans, s) {
      trans.delayReturn(true);
      jwcrypto.generateKeypair({algorithm: "DS", keysize: BrowserID.KEY_LENGTH}, function(err, kp) {
        keypair = kp;
        trans.complete(keypair.publicKey.serialize());
      });
    });

    chan.bind('raiseProvisioningFailure', function(trans, s) {
      tearDown();
      fail('primaryError', s);
    });

    // this is what happens when there is an error
    chan.bind('registerCertificate', function(trans, cert) {
      // this means we have successfully completed the party!
      // keypair is our keypair,
      // cert is our certificate,
      // email is the email that's vouched for.
      // fantastic!
      tearDown();
      successCB(keypair, cert);
    });

  };

  return Provisioning;
}());
