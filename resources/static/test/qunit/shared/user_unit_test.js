/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID: true */
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
var jwk = require("./jwk");
var jwt = require("./jwt");
var jwcert = require("./jwcert");
var vep = require("./vep");

(function() {
  var bid = BrowserID,
      lib = bid.User,
      storage = bid.Storage,
      network = bid.Network,
      xhr = bid.Mocks.xhr,
      testHelpers = bid.TestHelpers,
      testOrigin = testHelpers.testOrigin,
      provisioning = bid.Mocks.Provisioning

  // I generated these locally, they are used nowhere else.
  var pubkey = {"algorithm":"RS","n":"56063028070432982322087418176876748072035482898334811368408525596198252519267108132604198004792849077868951906170812540713982954653810539949384712773390200791949565903439521424909576832418890819204354729217207360105906039023299561374098942789996780102073071760852841068989860403431737480182725853899733706069","e":"65537"};

  // this cert is meaningless, but it has the right format
  var random_cert = "eyJhbGciOiJSUzEyOCJ9.eyJpc3MiOiJpc3N1ZXIuY29tIiwiZXhwIjoxMzE2Njk1MzY3NzA3LCJwdWJsaWMta2V5Ijp7ImFsZ29yaXRobSI6IlJTIiwibiI6IjU2MDYzMDI4MDcwNDMyOTgyMzIyMDg3NDE4MTc2ODc2NzQ4MDcyMDM1NDgyODk4MzM0ODExMzY4NDA4NTI1NTk2MTk4MjUyNTE5MjY3MTA4MTMyNjA0MTk4MDA0NzkyODQ5MDc3ODY4OTUxOTA2MTcwODEyNTQwNzEzOTgyOTU0NjUzODEwNTM5OTQ5Mzg0NzEyNzczMzkwMjAwNzkxOTQ5NTY1OTAzNDM5NTIxNDI0OTA5NTc2ODMyNDE4ODkwODE5MjA0MzU0NzI5MjE3MjA3MzYwMTA1OTA2MDM5MDIzMjk5NTYxMzc0MDk4OTQyNzg5OTk2NzgwMTAyMDczMDcxNzYwODUyODQxMDY4OTg5ODYwNDAzNDMxNzM3NDgwMTgyNzI1ODUzODk5NzMzNzA2MDY5IiwiZSI6IjY1NTM3In0sInByaW5jaXBhbCI6eyJlbWFpbCI6InRlc3R1c2VyQHRlc3R1c2VyLmNvbSJ9fQ.aVIO470S_DkcaddQgFUXciGwq2F_MTdYOJtVnEYShni7I6mqBwK3fkdWShPEgLFWUSlVUtcy61FkDnq2G-6ikSx1fUZY7iBeSCOKYlh6Kj9v43JX-uhctRSB2pI17g09EUtvmb845EHUJuoowdBLmLa4DSTdZE-h4xUQ9MsY7Ik";


  function testAssertion(assertion, cb) {
    equal(typeof assertion, "string", "An assertion was correctly generated");

    // Decode the assertion to a bundle.
    // var bundle = JSON.parse(window.atob(assertion));
    // WOW, ^^ was assuming a specific format, let's fix that
    var bundle = vep.unbundleCertsAndAssertion(assertion);

    // Make sure both parts of the bundle exist
    ok(bundle.certificates && bundle.certificates.length, "we have an array like object for the certificates");
    equal(typeof bundle.assertion, "string");

    // Decode the assertion itself
    var tok = new jwt.JWT();
    tok.parse(bundle.assertion);


    // Check for parts of the assertion
    equal(tok.audience, testOrigin, "correct audience");
    var expires = tok.expires.getTime();
    ok(typeof expires === "number" && !isNaN(expires), "expiration date is valid");

    // this should be based on server time, not local time.
    network.serverTime(function(time) {
      var nowPlus2Mins = time.getTime() + (2 * 60 * 1000);

      // expiration date must be within 5 seconds of 2 minutes from now - see
      // issue 433 (https://github.com/mozilla/browserid/issues/433)
      var diff = Math.abs(expires - nowPlus2Mins);
      ok(diff < 5000, "expiration date must be within 5 seconds of 2 minutes from now: " + diff);

      equal(typeof tok.cryptoSegment, "string", "cryptoSegment exists");
      equal(typeof tok.headerSegment, "string", "headerSegment exists");
      equal(typeof tok.payloadSegment, "string", "payloadSegment exists");

      if(cb) cb();
    });
  }

  module("shared/user", {
    setup: function() {
      testHelpers.setup();
    },
    teardown: function() {
      testHelpers.teardown();
    }
  });

  test("setOrigin, getOrigin", function() {
    lib.setOrigin(testOrigin);
    equal(lib.getOrigin(), testOrigin);
  });

  test("setOrigin, getHostname", function() {
    var origin = "http://browserid.org";
    lib.setOrigin(origin);

    var hostname = lib.getHostname();
    equal(hostname, "browserid.org", "getHostname returns only the hostname");
  });

  test("getStoredEmailKeypairs", function() {
    var identities = lib.getStoredEmailKeypairs();
    equal("object", typeof identities, "we have some identities");
  });

  asyncTest("getStoredEmailKeypair with known key", function() {
    lib.syncEmailKeypair("testuser@testuser.com", function() {
      var identity = lib.getStoredEmailKeypair("testuser@testuser.com");

      ok(identity, "we have an identity");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  test("getStoredEmailKeypair with unknown key", function() {
    var identity = lib.getStoredEmailKeypair("testuser@testuser.com");

    equal(typeof identity, "undefined", "identity is undefined for unknown key");
  });

  test("clearStoredEmailKeypairs", function() {
    lib.clearStoredEmailKeypairs();
    var identities = lib.getStoredEmailKeypairs();
    var count = 0;
    for(var key in identities) {
      if(identities.hasOwnProperty(key)) {
        count++;
      }
    }

    equal(0, count, "after clearing, there are no identities");
  });

  asyncTest("createSecondaryUser", function() {
    lib.createSecondaryUser("testuser@testuser.com", function(status) {
      ok(status, "user created");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("createSecondaryUser with user creation refused", function() {
    xhr.useResult("throttle");

    lib.createSecondaryUser("testuser@testuser.com", function(status) {
      equal(status, false, "user creation refused");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("createSecondaryUser with XHR failure", function() {
    xhr.useResult("ajaxError");

    lib.createSecondaryUser(
      "testuser@testuser.com",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("createUser with unknown secondary happy case - expect 'secondary.verify'", function() {
    xhr.useResult("unknown_secondary");

    lib.createUser("unregistered@testuser.com", function(status) {
      equal(status, "secondary.verify", "secondary user must be verified");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("createUser with unknown secondary, throttled - expect status='secondary.could_not_add'", function() {
    xhr.useResult("throttle");

    lib.createUser("unregistered@testuser.com", function(status) {
      equal(status, "secondary.could_not_add", "user creation refused");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("createUser with unknown secondary, XHR failure - expect failure call", function() {
    xhr.useResult("ajaxError");

    lib.createUser("unregistered@testuser.com",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("createUser with primary, user verified with primary - expect 'primary.verified'", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);

    lib.createUser("unregistered@testuser.com", function(status) {
      equal(status, "primary.verified", "primary user is already verified, correct status");
      network.checkAuth(function(authenticated) {
        equal(authenticated, true, "after provisioning user, user should be automatically authenticated to BrowserID");
        start();
      });
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("createUser with primary, user must authenticate with primary - expect 'primary.verify'", function() {
    xhr.useResult("primary");

    lib.createUser("unregistered@testuser.com", function(status) {
      equal(status, "primary.verify", "primary must verify with primary, correct status");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("createUser with primary, unknown provisioning failure, expect XHR failure callback", function() {
    xhr.useResult("primary");
    provisioning.setFailure({
      code: "primaryError",
      msg: "some error"
    });

    lib.createUser("unregistered@testuser.com",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("createUserWithInfo", function() {
    ok(true, "For development speed and reduced duplication of tests, tested via createUser");
    start();
  });

  asyncTest("provisionPrimaryUser authenticated with IdP, expect primary.verified", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);

    lib.provisionPrimaryUser("unregistered@testuser.com", {},
      function(status, info) {
        equal(status, "primary.verified", "primary user is already verified, correct status");
        start();
      },
      testHelpers.unexpectedXHRFailure
    );
  });

  asyncTest("provisionPrimaryUser not authenticated with IdP, expect primary.verify", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);

    lib.provisionPrimaryUser("unregistered@testuser.com", {},
      function(status, info) {
        equal(status, "primary.verify", "primary user is not verified, correct status");
        start();
      },
      testHelpers.unexpectedXHRFailure
    );
  });

  asyncTest("provisionPrimaryUser with provisioning failure - call failure", function() {
    xhr.useResult("primary");
    provisioning.setFailure("failure");

    lib.provisionPrimaryUser("unregistered@testuser.com", {},
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("primaryUserAuthenticationInfo, user authenticated to IdP, expect keypair, cert, authenticated status", function() {
    provisioning.setStatus(provisioning.AUTHENTICATED);

    lib.primaryUserAuthenticationInfo("testuser@testuser.com", {},
      function(info) {
        equal(info.authenticated, true, "user is authenticated");
        ok(info.keypair, "keypair passed");
        ok(info.cert, "cert passed");
        start();
      },
      testHelpers.unexpectedXHRError
    );
  });

  asyncTest("primaryUserAuthenticationInfo, user not authenticated to IdP, expect false authenticated status", function() {
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);

    lib.primaryUserAuthenticationInfo("testuser@testuser.com", {},
      function(info) {
        equal(info.authenticated, false, "user is not authenticated");
        start();
      },
      testHelpers.unexpectedXHRError
    );
  });

  asyncTest("primaryUserAuthenticationInfo with XHR failure", function() {
    provisioning.setFailure("failure");

    lib.primaryUserAuthenticationInfo("testuser@testuser.com", {},
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("isUserAuthenticatedToPrimary with authed user, expect true status", function() {
    provisioning.setStatus(provisioning.AUTHENTICATED);

    lib.isUserAuthenticatedToPrimary("testuser@testuser.com", {},
      function(status) {
        equal(status, true, "user is authenticated, correct status");
        start();
      },
      testHelpers.unexpectedXHRError
    );
  });

  asyncTest("isUserAuthenticatedToPrimary with non-authed user, expect false status", function() {
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);

    lib.isUserAuthenticatedToPrimary("testuser@testuser.com", {},
      function(status) {
        equal(status, false, "user is not authenticated, correct status");
        start();
      },
      testHelpers.unexpectedXHRError
    );
  });

  asyncTest("isUserAuthenticatedToPrimary with failure", function() {
    provisioning.setFailure("failure");

    lib.isUserAuthenticatedToPrimary("testuser@testuser.com", {},
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("waitForUserValidation with `complete` response", function() {
    storage.setStagedOnBehalfOf(testOrigin);

    xhr.useResult("complete");

    lib.waitForUserValidation("registered@testuser.com", function(status) {
      equal(status, "complete", "complete response expected");

      ok(!storage.getStagedOnBehalfOf(), "staged on behalf of is cleared when validation completes");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("waitForUserValidation with `mustAuth` response", function() {
    storage.setStagedOnBehalfOf(testOrigin);

    xhr.useResult("mustAuth");

    lib.waitForUserValidation("registered@testuser.com", function(status) {
      equal(status, "mustAuth", "mustAuth response expected");

      ok(!storage.getStagedOnBehalfOf(), "staged on behalf of is cleared when validation completes");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("waitForUserValidation with `noRegistration` response", function() {
    xhr.useResult("noRegistration");

    storage.setStagedOnBehalfOf(testOrigin);
    lib.waitForUserValidation("registered@testuser.com", function(status) {
      ok(false, "not expecting success")

      start();
    }, function(status) {
      ok(storage.getStagedOnBehalfOf(), "staged on behalf of is not cleared for noRegistration response");
      ok(status, "noRegistration", "noRegistration response causes failure");
      start();
    });
  });


  asyncTest("waitForUserValidation with XHR failure", function() {
    xhr.useResult("ajaxError");

    storage.setStagedOnBehalfOf(testOrigin);
    lib.waitForUserValidation("registered@testuser.com", function(status) {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(storage.getStagedOnBehalfOf(), "staged on behalf of is not cleared on XHR failure");
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });

  asyncTest("cancelUserValidation: ~1 second", function() {
    xhr.useResult("pending");

    storage.setStagedOnBehalfOf(testOrigin);
    lib.waitForUserValidation("registered@testuser.com", function(status) {
      ok(false, "not expecting success")
    }, function(status) {
      ok(false, "not expecting failure");
    });

    setTimeout(function() {
      lib.cancelUserValidation();
      ok(storage.getStagedOnBehalfOf(), "staged on behalf of is not cleared when validation cancelled");
      start();
    }, 500);
  });

  asyncTest("tokenInfo with a good token and origin info, expect origin in results", function() {
    storage.setStagedOnBehalfOf(testOrigin);

    lib.tokenInfo("token", function(info) {
      equal(info.email, "testuser@testuser.com", "correct email");
      equal(info.origin, testOrigin, "correct origin");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("tokenInfo with a bad token without site info, no site in results", function() {
    lib.tokenInfo("token", function(info) {
      equal(info.email, "testuser@testuser.com", "correct email");
      equal(typeof info.origin, "undefined", "origin is undefined");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("tokenInfo with XHR error", function() {
    xhr.useResult("ajaxError");
    lib.tokenInfo(
      "token",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("verifyUser with a good token", function() {
    storage.setStagedOnBehalfOf(testOrigin);

    lib.verifyUser("token", "password", function onSuccess(info) {

      ok(info.valid, "token was valid");
      equal(info.email, "testuser@testuser.com", "email part of info");
      equal(info.origin, testOrigin, "origin in info");
      equal(storage.getStagedOnBehalfOf(), "", "initiating origin was removed");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("verifyUser with a bad token", function() {
    xhr.useResult("invalid");

    lib.verifyUser("token", "password", function onSuccess(info) {
      equal(info.valid, false, "bad token calls onSuccess with a false validity");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("verifyUser with an XHR failure", function() {
    xhr.useResult("ajaxError");

    lib.verifyUser("token", "password", function onSuccess(info) {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });

  /*
  asyncTest("setPassword", function() {
    lib.setPassword("password", function() {
      // XXX fill this in.
      ok(true);
      start();
    });
  });
  */
  asyncTest("requestPasswordReset with known email", function() {
    lib.requestPasswordReset("registered@testuser.com", function(status) {
      equal(status.success, true, "password reset for known user");
      start();
    }, function() {
      ok(false, "onFailure should not be called");
      start();
    });
  });

  asyncTest("requestPasswordReset with unknown email", function() {
    lib.requestPasswordReset("unregistered@testuser.com", function(status) {
      equal(status.success, false, "password not reset for unknown user");
      equal(status.reason, "invalid_user", "invalid_user is the reason");
      start();
    }, function() {
      ok(false, "onFailure should not be called");
      start();
    });
  });

  asyncTest("requestPasswordReset with throttle", function() {
    xhr.useResult("throttle");
    lib.requestPasswordReset("registered@testuser.com", function(status) {
      equal(status.success, false, "password not reset for throttle");
      equal(status.reason, "throttle", "password reset was throttled");
      start();
    }, function() {
      ok(false, "onFailure should not be called");
      start();
    });
  });

  asyncTest("requestPasswordReset with XHR failure", function() {
    xhr.useResult("ajaxError");
    lib.requestPasswordReset("registered@testuser.com", function(status) {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });


  asyncTest("authenticate with valid credentials", function() {
    lib.authenticate("testuser@testuser.com", "testuser", function(authenticated) {
      equal(true, authenticated, "we are authenticated!");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("authenticate with invalid credentials", function() {
    xhr.useResult("invalid");
    lib.authenticate("testuser@testuser.com", "testuser", function onComplete(authenticated) {
      equal(false, authenticated, "invalid authentication.");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("authenticate with XHR failure", function() {
    xhr.useResult("ajaxError");
    lib.authenticate("testuser@testuser.com", "testuser", function onComplete(authenticated) {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });


  asyncTest("checkAuthentication with valid authentication", function() {
    xhr.setContextInfo("authenticated", true);
    lib.checkAuthentication(function(authenticated) {
      equal(authenticated, true, "We are authenticated!");
      start();
    });
  });



  asyncTest("checkAuthentication with invalid authentication", function() {
    xhr.setContextInfo("authenticated", false);
    lib.checkAuthentication(function(authenticated) {
      equal(authenticated, false, "We are not authenticated!");
      start();
    });
  });



  asyncTest("checkAuthentication with XHR failure", function() {
    xhr.useResult("contextAjaxError");
    lib.checkAuthentication(function(authenticated) {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });



  asyncTest("checkAuthenticationAndSync with valid authentication", function() {
    xhr.setContextInfo("authenticated", true);

    lib.checkAuthenticationAndSync(function onSuccess() {},
    function onComplete(authenticated) {
      equal(authenticated, true, "We are authenticated!");
      start();
    });
  });



  asyncTest("checkAuthenticationAndSync with invalid authentication", function() {
    xhr.setContextInfo("authenticated", false);

    lib.checkAuthenticationAndSync(function onSuccess() {
        ok(false, "We are not authenticated!");
        start();
      }, function onComplete(authenticated) {
      equal(authenticated, false, "We are not authenticated!");
      start();
    });
  });


  asyncTest("checkAuthenticationAndSync with XHR failure", function() {
    xhr.setContextInfo("authenticated", true);
    xhr.useResult("ajaxError");

    lib.checkAuthenticationAndSync(function onSuccess() {
    }, function onComplete() {
      ok(false, "xhr failure should never succeed");

      start();
    }, function onFailure() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });

  asyncTest("isEmailRegistered with registered email", function() {
    lib.isEmailRegistered("registered@testuser.com", function(registered) {
      ok(registered);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

  });

  asyncTest("isEmailRegistered with unregistered email", function() {
    lib.isEmailRegistered("unregistered@testuser.com", function(registered) {
      equal(registered, false);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });
  });

  asyncTest("isEmailRegistered with XHR failure", function() {
    xhr.useResult("ajaxError");
    lib.isEmailRegistered("registered", function(registered) {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });

  asyncTest("addEmail", function() {
    lib.addEmail("testemail@testemail.com", function(added) {
      ok(added, "user was added");

      var identities = lib.getStoredEmailKeypairs();
      equal(false, "testemail@testemail.com" in identities, "Our new email is not added until confirmation.");

      equal(storage.getStagedOnBehalfOf(), lib.getHostname(), "initiatingOrigin is stored");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("addEmail with addition refused", function() {
    xhr.useResult("throttle");

    lib.addEmail("testemail@testemail.com", function(added) {
      equal(added, false, "user addition was refused");

      var identities = lib.getStoredEmailKeypairs();
      equal(false, "testemail@testemail.com" in identities, "Our new email is not added until confirmation.");

      equal(typeof storage.getStagedOnBehalfOf(), "undefined", "initiatingOrigin is not stored");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("addEmail with XHR failure", function() {
    xhr.useResult("ajaxError");
    lib.addEmail("testemail@testemail.com", function(added) {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });


 asyncTest("waitForEmailValidation `complete` response", function() {
    storage.setStagedOnBehalfOf(testOrigin);

    xhr.useResult("complete");
    lib.waitForEmailValidation("registered@testuser.com", function(status) {
      ok(!storage.getStagedOnBehalfOf(), "staged on behalf of is cleared when validation completes");
      equal(status, "complete", "complete response expected");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("waitForEmailValidation `mustAuth` response", function() {
    storage.setStagedOnBehalfOf(testOrigin);
    xhr.useResult("mustAuth");

    lib.waitForEmailValidation("registered@testuser.com", function(status) {
      ok(!storage.getStagedOnBehalfOf(), "staged on behalf of is cleared when validation completes");
      equal(status, "mustAuth", "mustAuth response expected");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("waitForEmailValidation with `noRegistration` response", function() {
    storage.setStagedOnBehalfOf(testOrigin);
    xhr.useResult("noRegistration");

    lib.waitForEmailValidation("registered@testuser.com", function(status) {
      ok(false, "not expecting success")
      start();
    }, function(status) {
      ok(storage.getStagedOnBehalfOf(), "staged on behalf of is cleared when validation completes");
      ok(status, "noRegistration", "noRegistration response causes failure");
      start();
    });
  });


 asyncTest("waitForEmailValidation XHR failure", function() {
    storage.setStagedOnBehalfOf(testOrigin);
    xhr.useResult("ajaxError");

    lib.waitForEmailValidation("registered@testuser.com", function(status) {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(storage.getStagedOnBehalfOf(), "staged on behalf of is cleared when validation completes");
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });


  asyncTest("cancelEmailValidation: ~1 second", function() {
    xhr.useResult("pending");

    storage.setStagedOnBehalfOf(testOrigin);
    lib.waitForEmailValidation("registered@testuser.com", function(status) {
      ok(false, "not expecting success")
    }, function(status) {
      ok(false, "not expecting failure");
    });

    setTimeout(function() {
      lib.cancelUserValidation();
      ok(storage.getStagedOnBehalfOf(), "staged on behalf of is not cleared when validation cancelled");
      start();
    }, 500);
  });

  asyncTest("verifyEmailNoPassword with a good token - callback with email, orgiin, and valid", function() {
    storage.setStagedOnBehalfOf(testOrigin);
    lib.verifyEmailNoPassword("token", function onSuccess(info) {

      ok(info.valid, "token was valid");
      equal(info.email, "testuser@testuser.com", "email part of info");
      equal(info.origin, testOrigin, "origin in info");
      equal(storage.getStagedOnBehalfOf(), "", "initiating origin was removed");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("verifyEmailNoPassword with a bad token - callback with valid: false", function() {
    xhr.useResult("invalid");

    lib.verifyEmailNoPassword("token", function onSuccess(info) {
      equal(info.valid, false, "bad token calls onSuccess with a false validity");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("verifyEmailNoPassword with an XHR failure", function() {
    xhr.useResult("ajaxError");

    lib.verifyEmailNoPassword(
      "token",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("verifyEmailWithPassword with a good token - callback with email, origin, valid", function() {
    storage.setStagedOnBehalfOf(testOrigin);
    lib.verifyEmailWithPassword("token", "password", function onSuccess(info) {

      ok(info.valid, "token was valid");
      equal(info.email, "testuser@testuser.com", "email part of info");
      equal(info.origin, testOrigin, "origin in info");
      equal(storage.getStagedOnBehalfOf(), "", "initiating origin was removed");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("verifyEmailWithPassword with a bad token - callback with valid: false", function() {
    xhr.useResult("invalid");

    lib.verifyEmailWithPassword("token", "password", function onSuccess(info) {
      equal(info.valid, false, "bad token calls onSuccess with a false validity");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("verifyEmailWithPassword with an XHR failure", function() {
    xhr.useResult("ajaxError");

    lib.verifyEmailWithPassword(
      "token",
      "password",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("syncEmailKeypair with successful sync", function() {
    lib.syncEmailKeypair("testemail@testemail.com", function(keypair) {
      var identity = lib.getStoredEmailKeypair("testemail@testemail.com");

      ok(identity, "we have an identity");
      ok(identity.priv, "a private key is on the identity");
      ok(identity.pub, "a private key is on the identity");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("syncEmailKeypair with invalid sync", function() {
    xhr.useResult("invalid");
    lib.syncEmailKeypair("testemail@testemail.com", function(keypair) {
      ok(false, "sync was invalid, this should have failed");
      start();
    }, function() {
      var identity = lib.getStoredEmailKeypair("testemail@testemail.com");
      equal(typeof identity, "undefined", "Invalid email is not synced");

      start();
    });
  });

  asyncTest("syncEmailKeypair with XHR failure", function() {
    xhr.useResult("ajaxError");
    lib.syncEmailKeypair("testemail@testemail.com", function(keypair) {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });


  asyncTest("removeEmail that is added", function() {
    storage.addEmail("testemail@testemail.com", {pub: "pub", priv: "priv"});

    lib.removeEmail("testemail@testemail.com", function() {
      var identities = lib.getStoredEmailKeypairs();
      equal(false, "testemail@testemail.com" in identities, "Our new email is removed");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });



  asyncTest("removeEmail that is not added", function() {
    lib.removeEmail("testemail@testemail.com", function() {
      var identities = lib.getStoredEmailKeypairs();
      equal(false, "testemail@testemail.com" in identities, "Our new email is removed");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("removeEmail with XHR failure", function() {
    storage.addEmail("testemail@testemail.com", {pub: "pub", priv: "priv"});

    xhr.useResult("ajaxError");
    lib.removeEmail("testemail@testemail.com", function() {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });




  asyncTest("syncEmails with no pre-loaded identities and no identities to add", function() {
    xhr.useResult("no_identities");
    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok(true, "we have synced identities");
      equal(_.size(identities), 0, "there are no identities");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("syncEmails with no pre-loaded identities and identities to add", function() {
    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok("testuser@testuser.com" in identities, "Our new email is added");
      equal(_.size(identities), 1, "there is one identity");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("syncEmails with identities preloaded and none to add", function() {
    storage.addEmail("testuser@testuser.com", {});
    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok("testuser@testuser.com" in identities, "Our new email is added");
      equal(_.size(identities), 1, "there is one identity");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("syncEmails with identities preloaded and one to add", function() {
    storage.addEmail("testuser@testuser.com", {pubkey: pubkey, cert: random_cert});

    xhr.useResult("multiple");

    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok("testuser@testuser.com" in identities, "Our old email address is still there");
      ok("testuser2@testuser.com" in identities, "Our new email is added");
      equal(_.size(identities), 2, "there are two identities");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("syncEmails with identities preloaded and one to remove", function() {
    storage.addEmail("testuser@testuser.com", {pub: pubkey, cert: random_cert});
    storage.addEmail("testuser2@testuser.com", {pub: pubkey, cert: random_cert});

    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok("testuser@testuser.com" in identities, "Our old email address is still there");
      equal("testuser2@testuser.com" in identities, false, "Our unknown email is removed");
      equal(_.size(identities), 1, "there is one identity");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("syncEmails with one to refresh", function() {
    storage.addEmail("testuser@testuser.com", {pub: pubkey, cert: random_cert});

    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok("testuser@testuser.com" in identities, "refreshed key is synced");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("syncEmails with XHR failure", function() {
    xhr.useResult("ajaxError");

    lib.syncEmails(function onSuccess() {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });

  asyncTest("getAssertion with known email that has key", function() {
    lib.syncEmailKeypair("testuser@testuser.com", function() {
      lib.getAssertion("testuser@testuser.com", lib.getOrigin(), function onSuccess(assertion) {
        testAssertion(assertion, start);
        equal(storage.site.get(testOrigin, "email"), "testuser@testuser.com", "email address was persisted");
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("getAssertion with known secondary email that does not have a key", function() {
    storage.addEmail("testuser@testuser.com", { type: "secondary" });
    lib.getAssertion("testuser@testuser.com", lib.getOrigin(), function onSuccess(assertion) {
      testAssertion(assertion, start);
      equal(storage.site.get(testOrigin, "email"), "testuser@testuser.com", "email address was persisted");
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("getAssertion with known primary email, expired cert, user authenticated with IdP - expect assertion", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);
    storage.addEmail("unregistered@testuser.com", { type: "primary" });

    lib.getAssertion(
      "unregistered@testuser.com",
      lib.getOrigin(),
      function(assertion) {
        testAssertion(assertion, start);
        equal(storage.site.get(testOrigin, "email"), "unregistered@testuser.com", "email address was persisted");
      },
      testHelpers.unexpectedXHRFailure);
  });

  asyncTest("getAssertion with known primary email, expired cert, user authenticated with IdP - expect null assertion", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
    storage.addEmail("unregistered@testuser.com", { type: "primary" });

    lib.getAssertion(
      "unregistered@testuser.com",
      lib.getOrigin(),
      function(assertion) {
        equal(assertion, null, "user must authenticate with IdP, no assertion");
        start();
      },
      testHelpers.unexpectedXHRFailure);
  });

  asyncTest("getAssertion with unknown email", function() {
    lib.syncEmailKeypair("testuser@testuser.com", function() {
      lib.getAssertion("testuser2@testuser.com", lib.getOrigin(), function onSuccess(assertion) {
        equal(null, assertion, "email was unknown, we do not have an assertion");
        equal(storage.site.get(testOrigin, "email"), undefined, "email address was not set");
        start();
      });
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("getAssertion with XHR failure", function() {
    storage.addEmail("testuser@testuser.com", {});
    xhr.useResult("ajaxError");
    lib.getAssertion(
      "testuser@testuser.com",
      lib.getOrigin(),
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });


  asyncTest("logoutUser", function(onSuccess) {
    lib.authenticate("testuser@testuser.com", "testuser", function(authenticated) {
      lib.syncEmails(function() {
        var storedIdentities = storage.getEmails();
        equal(_.size(storedIdentities), 1, "one identity");

        lib.logoutUser(function() {
          storedIdentities = storage.getEmails();
          equal(_.size(storedIdentities), 0, "All items have been removed on logout");

          start();
        }, testHelpers.unexpectedXHRFailure);
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);


  });

  asyncTest("logoutUser with XHR failure", function(onSuccess) {
    lib.authenticate("testuser@testuser.com", "testuser", function(authenticated) {
      lib.syncEmails(function() {
         xhr.useResult("ajaxError");

        lib.logoutUser(function() {
          ok(false, "xhr failure should never succeed");
          start();
        }, function() {
          ok(true, "xhr failure should always be a failure");
          start();
        });


      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);


  });

  asyncTest("cancelUser", function(onSuccess) {
    lib.cancelUser(function() {
      var storedIdentities = storage.getEmails();
      equal(_.size(storedIdentities), 0, "All items have been removed");
      start();
    });


  });

  asyncTest("cancelUser with XHR failure", function(onSuccess) {
    xhr.useResult("ajaxError");
    lib.cancelUser(function() {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });


  });

  asyncTest("getPersistentSigninAssertion with invalid login - expect null assertion", function() {
    xhr.setContextInfo("authenticated", false);

    lib.syncEmailKeypair("testuser@testuser.com", function() {
      storage.site.set(testOrigin, "remember", false);
      storage.site.set(testOrigin, "email", "testuser@testuser.com");
      xhr.useResult("invalid");

      lib.getPersistentSigninAssertion(function onComplete(assertion) {
        strictEqual(assertion, null, "assertion with invalid login is null");
        start();
      }, function onFailure() {
        ok(false, "no expected XHR failure");
        start();
      });
    });


  });

  asyncTest("getPersistentSigninAssertion without email set for site - expect null assertion", function() {
    xhr.setContextInfo("authenticated", true);
    storage.site.set(testOrigin, "remember", true);
    storage.site.remove(testOrigin, "email");

    lib.getPersistentSigninAssertion(function onComplete(assertion) {
      strictEqual(assertion, null, "assertion with no email is null");
      start();
    }, function onFailure() {
      ok(false, "no expected XHR failure");
      start();
    });


  });

  asyncTest("getPersistentSigninAssertion without remember set for site - expect null assertion", function() {
    xhr.setContextInfo("authenticated", true);
    lib.syncEmailKeypair("testuser@testuser.com", function() {
      storage.site.set(testOrigin, "remember", false);
      storage.site.set(testOrigin, "email", "testuser@testuser.com");
      // invalidate the email so that we force a fresh key certification with
      // the server
      storage.invalidateEmail("testuser@testuser.com");

      lib.getPersistentSigninAssertion(function onComplete(assertion) {
        strictEqual(assertion, null, "assertion with remember=false is null");
        start();
      }, function onFailure() {
        ok(false, "no expected XHR failure");
        start();
      });
    });
  });

  asyncTest("getPersistentSigninAssertion with valid login, email, and remember set to true - expect assertion", function() {
    xhr.setContextInfo("authenticated", true);
    lib.syncEmailKeypair("testuser@testuser.com", function() {
      storage.site.set(testOrigin, "remember", true);
      storage.site.set(testOrigin, "email", "testuser@testuser.com");
      // invalidate the email so that we force a fresh key certification with
      // the server
      storage.invalidateEmail("testuser@testuser.com");

      lib.getPersistentSigninAssertion(function onComplete(assertion) {
        ok(assertion, "we have an assertion!");
        start();
      }, function onFailure() {
        ok(false, "no expected XHR failure");
        start();
      });
    });
  });

  asyncTest("getPersistentSigninAssertion with XHR failure", function() {
    xhr.setContextInfo("authenticated", true);
    lib.syncEmailKeypair("testuser@testuser.com", function() {
      storage.site.set(testOrigin, "remember", true);
      storage.site.set(testOrigin, "email", "testuser@testuser.com");
      // invalidate the email so that we force a fresh key certification with
      // the server
      storage.invalidateEmail("testuser@testuser.com");

      xhr.useResult("ajaxError");

      lib.getPersistentSigninAssertion(function onComplete(assertion) {
        ok(false, "ajax error should not pass");
        start();
      }, function onFailure() {
        ok(true, "ajax error should not pass");
        start();
      });
    });


  });

  asyncTest("clearPersistentSignin with invalid login", function() {
    xhr.setContextInfo("authenticated", false);

    lib.clearPersistentSignin(function onComplete(success) {
      strictEqual(success, false, "success with invalid login is false");
      start();
    }, function onFailure() {
      ok(false, "no expected XHR failure");
      start();
    });


  });

  asyncTest("clearPersistentSignin with valid login with remember set to true", function() {
    xhr.setContextInfo("authenticated", true);
    storage.site.set(testOrigin, "remember", true);

    lib.clearPersistentSignin(function onComplete(success) {
      strictEqual(success, true, "success flag good");
      strictEqual(storage.site.get(testOrigin, "remember"), false, "remember flag set to false");
      start();
    }, function onFailure() {
      ok(false, "no expected XHR failure");
      start();
    });


  });
}());
