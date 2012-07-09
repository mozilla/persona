/*jshint browser: true, forin: true, laxbreak: true */
/*global BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Mocks.Provisioning = (function() {

  "use strict";

  var keypair,
      // this cert is meaningless, but it has the right format
      cert = "eyJhbGciOiJSUzEyOCJ9.eyJpc3MiOiJpc3N1ZXIuY29tIiwiZXhwIjoxMzE2Njk1MzY3NzA3LCJwdWJsaWMta2V5Ijp7ImFsZ29yaXRobSI6IlJTIiwibiI6IjU2MDYzMDI4MDcwNDMyOTgyMzIyMDg3NDE4MTc2ODc2NzQ4MDcyMDM1NDgyODk4MzM0ODExMzY4NDA4NTI1NTk2MTk4MjUyNTE5MjY3MTA4MTMyNjA0MTk4MDA0NzkyODQ5MDc3ODY4OTUxOTA2MTcwODEyNTQwNzEzOTgyOTU0NjUzODEwNTM5OTQ5Mzg0NzEyNzczMzkwMjAwNzkxOTQ5NTY1OTAzNDM5NTIxNDI0OTA5NTc2ODMyNDE4ODkwODE5MjA0MzU0NzI5MjE3MjA3MzYwMTA1OTA2MDM5MDIzMjk5NTYxMzc0MDk4OTQyNzg5OTk2NzgwMTAyMDczMDcxNzYwODUyODQxMDY4OTg5ODYwNDAzNDMxNzM3NDgwMTgyNzI1ODUzODk5NzMzNzA2MDY5IiwiZSI6IjY1NTM3In0sInByaW5jaXBhbCI6eyJlbWFpbCI6InRlc3R1c2VyQHRlc3R1c2VyLmNvbSJ9fQ.aVIO470S_DkcaddQgFUXciGwq2F_MTdYOJtVnEYShni7I6mqBwK3fkdWShPEgLFWUSlVUtcy61FkDnq2G-6ikSx1fUZY7iBeSCOKYlh6Kj9v43JX-uhctRSB2pI17g09EUtvmb845EHUJuoowdBLmLa4DSTdZE-h4xUQ9MsY7Ik",
      failure,
      jwcrypto = require("./lib/jwcrypto"),
      status;

  function Provisioning(info, onsuccess, onfailure) {
    if(status === Provisioning.AUTHENTICATED) {
      if (!keypair) {
        // JWCrypto relies on there being a random seed.  The random seed is
        // gotten whenever network.withContext is called.  Since this is
        // supposed to mock the IdP provisioning step which will not call
        // network.withContext, add a random seed to ensure that we can get our
        // keypair.
        jwcrypto.addEntropy("H+ZgKuhjVckv/H4i0Qvj/JGJEGDVOXSIS5RCOjY9/Bo=");
        jwcrypto.generateKeypair({algorithm: "DS", keysize: BrowserID.KEY_LENGTH}, function(err, kp) {
          keypair = kp;
          if (onsuccess) onsuccess(keypair, cert);
        });
      }
      else {
        if (onsuccess) onsuccess(keypair, cert);
      }
    }
    else onfailure(failure);
  }

  Provisioning.setStatus = function(newStatus) {
    failure = null;

    status = newStatus;

    if(newStatus === Provisioning.NOT_AUTHENTICATED) {
      failure = {
        code: "primaryError",
        msg: "user is not authenticated as target user"
      };
    }
  };

  Provisioning.NOT_AUTHENTICATED = "not_authenticated";
  Provisioning.AUTHENTICATED = "authenticated";

  Provisioning.setFailure = function(status) {
    failure = status;
  };

  return Provisioning;
}());


