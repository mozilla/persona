/*jshint browsers:true, forin: true, laxbreak: true */
/*global BrowserID: true, _: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Provisioning = (function() {
  "use strict";

  var jwk = require("./jwk");

  var Provisioning = function(args, successCB, failureCB) {
    function tearDown() {
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

    if (!args || !args.email || !args.url) {
      return fail('internal', 'missing required arguments');
    }

    // extract the expected origin from the provisioning url
    // (this may be a different domain than the email domain part, if the
    //  domain delates authority)
    try {
      var origin = /^(https?:\/\/[^\/]+)\//.exec(args.url)[1];
    } catch(e) { alert(e); }
    if (!origin) {
      return fail('internal', 'bad provisioning url, can\'t extract origin');
    }

    // time to attempt to provision the user.  we'll embed a hidden iframe from the
    // primary
    var iframe = document.createElement("iframe");
    iframe.setAttribute('src', args.url);
    iframe.style.display = "none";
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
        // XXX: certificate duration should vary depending on a variety of factors:
        //   * user is on a device that is not her own
        //   * user is in an environment that can't handle the crypto
        cert_duration_s: (6 * 60 * 60)
      };
    });

    chan.bind('genKeyPair', function(trans, s) {
      keypair = jwk.KeyPair.generate("DS", BrowserID.KEY_LENGTH);
      return keypair.publicKey.toSimpleObject();
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

    // XXX: set a timeout for the amount of time that provisioning is allowed to take
  };

  return Provisioning;
}());
