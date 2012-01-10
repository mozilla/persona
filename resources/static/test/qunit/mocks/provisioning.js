/*jshint browsers:true, forin: true, laxbreak: true */
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
      jwk = require("./jwk"),
      status;

  function Provisioning(info, onsuccess, onfailure) {
    if(status === Provisioning.AUTHENTICATED) {
      onsuccess(keypair, cert);
    }
    else onfailure(failure);
  }

  Provisioning.setStatus = function(newStatus) {
    failure = null;

    if(newStatus === Provisioning.NOT_AUTHENTICATED) {
      failure = {
        code: "primaryError",
        msg: "user is not authenticated as target user"
      };
    }
    else if(newStatus === Provisioning.AUTHENTICATED) {
      keypair = keypair || jwk.KeyPair.generate("DS", 256);
    }

    status = newStatus;
  };

  Provisioning.NOT_AUTHENTICATED = "not_authenticated";
  Provisioning.AUTHENTICATED = "authenticated";

  Provisioning.setFailure = function(status) {
    failure = status;
  };

  return Provisioning;
}());


