/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  var jwcrypto = require("./lib/jwcrypto"),
      bid = BrowserID,
      lib = bid.User,
      storage = bid.Storage,
      network = bid.Network,
      mediator = bid.Mediator,
      xhr = bid.Mocks.xhr,
      testHelpers = bid.TestHelpers,
      testOrigin = testHelpers.testOrigin,
      failureCheck = testHelpers.failureCheck,
      testUndefined = testHelpers.testUndefined,
      testNotUndefined = testHelpers.testNotUndefined,
      testObjectValuesEqual = testHelpers.testObjectValuesEqual,
      provisioning = bid.Mocks.Provisioning,
      TEST_EMAIL = "testuser@testuser.com";

  // I generated these locally, they are used nowhere else.
  var pubkey = {"algorithm":"RS","n":"56063028070432982322087418176876748072035482898334811368408525596198252519267108132604198004792849077868951906170812540713982954653810539949384712773390200791949565903439521424909576832418890819204354729217207360105906039023299561374098942789996780102073071760852841068989860403431737480182725853899733706069","e":"65537"};

  // this cert is meaningless, but it has the right format
  var random_cert = "eyJhbGciOiJSUzEyOCJ9.eyJpc3MiOiJpc3N1ZXIuY29tIiwiZXhwIjoxMzE2Njk1MzY3NzA3LCJwdWJsaWMta2V5Ijp7ImFsZ29yaXRobSI6IlJTIiwibiI6IjU2MDYzMDI4MDcwNDMyOTgyMzIyMDg3NDE4MTc2ODc2NzQ4MDcyMDM1NDgyODk4MzM0ODExMzY4NDA4NTI1NTk2MTk4MjUyNTE5MjY3MTA4MTMyNjA0MTk4MDA0NzkyODQ5MDc3ODY4OTUxOTA2MTcwODEyNTQwNzEzOTgyOTU0NjUzODEwNTM5OTQ5Mzg0NzEyNzczMzkwMjAwNzkxOTQ5NTY1OTAzNDM5NTIxNDI0OTA5NTc2ODMyNDE4ODkwODE5MjA0MzU0NzI5MjE3MjA3MzYwMTA1OTA2MDM5MDIzMjk5NTYxMzc0MDk4OTQyNzg5OTk2NzgwMTAyMDczMDcxNzYwODUyODQxMDY4OTg5ODYwNDAzNDMxNzM3NDgwMTgyNzI1ODUzODk5NzMzNzA2MDY5IiwiZSI6IjY1NTM3In0sInByaW5jaXBhbCI6eyJlbWFpbCI6InRlc3R1c2VyQHRlc3R1c2VyLmNvbSJ9fQ.aVIO470S_DkcaddQgFUXciGwq2F_MTdYOJtVnEYShni7I6mqBwK3fkdWShPEgLFWUSlVUtcy61FkDnq2G-6ikSx1fUZY7iBeSCOKYlh6Kj9v43JX-uhctRSB2pI17g09EUtvmb845EHUJuoowdBLmLa4DSTdZE-h4xUQ9MsY7Ik";


  function testAssertion(assertion, cb) {
    equal(typeof assertion, "string", "An assertion was correctly generated");

    // Decode the assertion to a bundle.
    // var bundle = JSON.parse(window.atob(assertion));
    // WOW, ^^ was assuming a specific format, let's fix that
    var bundle = jwcrypto.cert.unbundle(assertion);

    // Make sure both parts of the bundle exist
    ok(bundle.certs && bundle.certs.length, "we have an array like object for the certificates");
    equal(typeof bundle.signedAssertion, "string");

    // Decode the assertion itself
    var components = jwcrypto.extractComponents(bundle.signedAssertion);

    // Check for parts of the assertion
    equal(components.payload.aud, testOrigin, "correct audience");
    var expires = parseInt(components.payload.exp, 10);
    ok(typeof expires === "number" && !isNaN(expires), "expiration date is valid");

    // this should be based on server time, not local time.
    network.serverTime(function(time) {
      var nowPlus2Mins = time.getTime() + (2 * 60 * 1000);

      // expiration date must be within 5 seconds of 2 minutes from now - see
      // issue 433 (https://github.com/mozilla/browserid/issues/433)
      // An IE8 VM takes about 7 seconds to generate an assertion.
      var diff = Math.abs(expires - nowPlus2Mins);
      ok(diff < 5000, "expiration date must be within 5 seconds of 2 minutes from now: " + diff);

      equal(typeof components.cryptoSegment, "string", "cryptoSegment exists");
      equal(typeof components.headerSegment, "string", "headerSegment exists");
      equal(typeof components.payloadSegment, "string", "payloadSegment exists");

      if(cb) cb();
    });
  }

  function testAddressVerificationPoll(authLevel, xhrResultName, pollFuncName, expectedResult) {
    storage.setReturnTo(testOrigin);
    xhr.useResult(xhrResultName);

    xhr.setContextInfo("auth_level", authLevel);
    lib[pollFuncName]("registered@testuser.com", function(status) {
      ok(!storage.getReturnTo(), "staged on behalf of is cleared when validation completes");
      equal(status, expectedResult, expectedResult + " response expected");

      // synced_address should be added as a result of syncing email addresses
      // when the verification poll completes.
      if (expectedResult === "complete") {
        testHelpers.testAddressesSyncedAfterUserRegistration();
      }
      start();
    }, testHelpers.unexpectedXHRFailure);
  }


  module("common/js/user", {
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
    var origin = "http://persona.org";
    lib.setOrigin(origin);

    var hostname = lib.getHostname();
    equal(hostname, "persona.org", "getHostname returns only the hostname");
  });

  test("setReturnTo, getReturnTo", function() {
    var returnTo = "http://samplerp.org";
    lib.setReturnTo(returnTo);
    equal(lib.getReturnTo(), returnTo, "get/setReturnTo work as expected");
  });

  test("setOriginEmail/getOriginEmail", function() {
    storage.addEmail("testuser@testuser.com");
    storage.addEmail("testuser2@testuser.com");

    lib.setOrigin("http://testdomain.org");

    lib.setOriginEmail("testuser@testuser.com");
    equal(lib.getOriginEmail(), "testuser@testuser.com", "correct email");

    lib.setOrigin("http://othertestdomain.org");
    lib.setOriginEmail("testuser2@testuser.com");

    lib.setOrigin("http://testdomain.org");
    equal(lib.getOriginEmail(), "testuser@testuser.com", "correct email");
  });

  test("getStoredEmailKeypairs without key - return all identities", function() {
    var identities = lib.getStoredEmailKeypairs();
    equal("object", typeof identities, "object returned");
  });

  test("getSortedEmailKeypairs - return array sorted by address", function() {
    storage.addEmail("third");
    storage.addEmail("second");
    storage.addEmail("first");

    var sortedIdentities = lib.getSortedEmailKeypairs();

    equal(sortedIdentities[0].address, "first", "correct first address");
    equal(sortedIdentities[2].address, "third", "correct third address");
  });

  asyncTest("getStoredEmailKeypair with known key - return identity", function() {
    lib.syncEmailKeypair(TEST_EMAIL, function() {
      var identity = lib.getStoredEmailKeypair(TEST_EMAIL);

      ok(identity, "we have an identity");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  test("getStoredEmailKeypair with unknown key", function() {
    var identity = lib.getStoredEmailKeypair(TEST_EMAIL);

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

  asyncTest("createSecondaryUser success - callback with true status", function() {
    lib.createSecondaryUser(TEST_EMAIL, "password", function(status) {
      ok(status.success, "user created");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("createSecondaryUser throttled - callback with false status", function() {
    xhr.useResult("throttle");

    lib.createSecondaryUser(TEST_EMAIL, "password", function(status) {
      testObjectValuesEqual(status, {
        success: false,
        reason: "throttle"
      });
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("createSecondaryUser with XHR failure", function() {
    failureCheck(lib.createSecondaryUser, TEST_EMAIL, "password");
  });


  asyncTest("createPrimaryUser with primary, user verified with primary - expect 'primary.verified'", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);
    lib.createPrimaryUser({email: "unregistered@testuser.com"}, function(status) {
      equal(status, "primary.verified", "primary user is already verified, correct status");
      network.checkAuth(function(authenticated) {
        equal(authenticated, "assertion", "after provisioning user, user should be automatically authenticated to Persona");
        start();
      });
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("createPrimaryUser with primary, user must authenticate with primary - expect 'primary.verify'", function() {
    xhr.useResult("primary");

    lib.createPrimaryUser({email: "unregistered@testuser.com"}, function(status) {
      equal(status, "primary.verify", "primary must verify with primary, correct status");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("createPrimaryUser with primary, unknown provisioning failure, expect XHR failure callback", function() {
    xhr.useResult("primary");
    provisioning.setFailure({
      code: "primaryError",
      msg: "some error"
    });

    lib.createPrimaryUser({email: "unregistered@testuser.com"},
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
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

    lib.primaryUserAuthenticationInfo(TEST_EMAIL, {},
      function(info) {
        equal(info.authenticated, true, "user is authenticated");
        ok(info.keypair, "keypair passed");
        ok(info.cert, "cert passed");
        start();
      },
      testHelpers.unexpectedXHRFailure
    );
  });

  asyncTest("primaryUserAuthenticationInfo, user not authenticated to IdP, expect false authenticated status", function() {
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);

    lib.primaryUserAuthenticationInfo(TEST_EMAIL, {},
      function(info) {
        equal(info.authenticated, false, "user is not authenticated");
        start();
      },
      testHelpers.unexpectedXHRFailure
    );
  });

  asyncTest("primaryUserAuthenticationInfo with XHR failure", function() {
    provisioning.setFailure("failure");

    lib.primaryUserAuthenticationInfo(
      TEST_EMAIL,
      {},
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("isUserAuthenticatedToPrimary with authed user, expect true status", function() {
    provisioning.setStatus(provisioning.AUTHENTICATED);

    lib.isUserAuthenticatedToPrimary(TEST_EMAIL, {},
      function(status) {
        equal(status, true, "user is authenticated, correct status");
        start();
      },
      testHelpers.unexpectedXHRFailure
    );
  });

  asyncTest("isUserAuthenticatedToPrimary with non-authed user, expect false status", function() {
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);

    lib.isUserAuthenticatedToPrimary(TEST_EMAIL, {},
      function(status) {
        equal(status, false, "user is not authenticated, correct status");
        start();
      },
      testHelpers.unexpectedXHRFailure
    );
  });

  asyncTest("isUserAuthenticatedToPrimary with failure", function() {
    provisioning.setFailure("failure");

    lib.isUserAuthenticatedToPrimary(TEST_EMAIL, {},
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("waitForUserValidation with no authentication & complete backend response - `mustAuth` response", function() {
    testAddressVerificationPoll(undefined, "complete", "waitForUserValidation", "mustAuth");
  });

  asyncTest("waitForUserValidation with assertion authentication & complete backend response - `mustAuth` response", function() {
    testAddressVerificationPoll("assertion", "complete", "waitForUserValidation", "mustAuth");
  });

  asyncTest("waitForUserValidation with password authentication - `complete` response", function() {
    testAddressVerificationPoll("password", "complete", "waitForUserValidation", "complete");
  });

  asyncTest("waitForUserValidation with `mustAuth` response", function() {
    testAddressVerificationPoll(undefined, "mustAuth", "waitForUserValidation", "mustAuth");
  });

  asyncTest("waitForUserValidation with `noRegistration` response", function() {
    xhr.useResult("noRegistration");

    storage.setReturnTo(testOrigin);
    lib.waitForUserValidation(
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      function(status) {
        ok(storage.getReturnTo(), "staged on behalf of is not cleared for noRegistration response");
        ok(status, "noRegistration", "noRegistration response causes failure");
        start();
      }
    );
  });


  asyncTest("waitForUserValidation with XHR failure", function() {
    storage.setReturnTo(testOrigin);
    xhr.useResult("ajaxError");
    lib.waitForUserValidation(
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      function() {
        ok(storage.getReturnTo(), "staged on behalf of is not cleared on XHR failure");
        ok(true, "xhr failure should always be a failure");
        start();
      }
    );
  });

  asyncTest("cancelUserValidation: ~1 second", function() {
    xhr.useResult("pending");

    storage.setReturnTo(testOrigin);
    // yes, we are neither expected succes nor failure because we are
    // cancelling the wait.
    lib.waitForUserValidation(
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      testHelpers.unexpectedXHRFailure
    );

    setTimeout(function() {
      lib.cancelUserValidation();
      ok(storage.getReturnTo(), "staged on behalf of is not cleared when validation cancelled");
      start();
    }, 500);
  });

  asyncTest("tokenInfo with a good token and returnTo info, expect returnTo in results", function() {
    storage.setReturnTo(testOrigin);

    lib.tokenInfo("token", function(info) {
      equal(info.email, TEST_EMAIL, "correct email");
      equal(info.returnTo, testOrigin, "correct returnTo");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("tokenInfo with a bad token without returnTo info, no returnTo in results", function() {
    lib.tokenInfo("token", function(info) {
      equal(info.email, TEST_EMAIL, "correct email");
      equal(typeof info.returnTo, "undefined", "returnTo is undefined");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("tokenInfo with XHR error", function() {
    failureCheck(lib.tokenInfo, "token");
  });

  asyncTest("verifyUser with a good token", function() {
    storage.setReturnTo(testOrigin);
    storage.addEmail(TEST_EMAIL);

    lib.verifyUser("token", "password", function onSuccess(info) {

      testObjectValuesEqual(info, {
        valid: true,
        email: TEST_EMAIL,
        returnTo: testOrigin
      });
      equal(storage.getReturnTo(), "", "initiating origin was removed");

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

    lib.verifyUser(
      "token",
      "password",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("canSetPassword with only primary addresses - expect false", function() {
    xhr.setContextInfo("has_password", false);

    storage.addEmail(TEST_EMAIL);

    lib.canSetPassword(function(status) {
      equal(false, status, "status is false with user with only primaries");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("canSetPassword with secondary addresses - expect true", function() {
    xhr.setContextInfo("has_password", true);

    storage.addEmail(TEST_EMAIL);

    lib.canSetPassword(function(status) {
      equal(true, status, "status is true with user with secondaries");
      start();
    }, testHelpers.unexpectedFailure);
  });

  asyncTest("requestPasswordReset with known email - true status", function() {
    var returnTo = "http://samplerp.org";
    lib.setReturnTo(returnTo);

    lib.requestPasswordReset("registered@testuser.com", "password", function(status) {
      equal(status.success, true, "password reset for known user");
      equal(storage.getReturnTo(), returnTo, "RP URL is stored for verification");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("requestPasswordReset with unknown email - false status, invalid_user", function() {
    lib.requestPasswordReset("unregistered@testuser.com", "password", function(status) {
      equal(status.success, false, "password not reset for unknown user");
      equal(status.reason, "invalid_user", "invalid_user is the reason");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("requestPasswordReset with throttle - false status, throttle", function() {
    xhr.useResult("throttle");
    lib.requestPasswordReset("registered@testuser.com", "password", function(status) {
      equal(status.success, false, "password not reset for throttle");
      equal(status.reason, "throttle", "password reset was throttled");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("requestPasswordReset with XHR failure", function() {
    failureCheck(lib.requestPasswordReset, "registered@testuser.com", "password");
  });

  asyncTest("completePasswordReset with a good token", function() {
    storage.addEmail(TEST_EMAIL);
    storage.setReturnTo(testOrigin);

    lib.completePasswordReset("token", "password", function onSuccess(info) {
      testObjectValuesEqual(info, {
        valid: true,
        email: TEST_EMAIL,
        returnTo: testOrigin
      });

      equal(storage.getReturnTo(), "", "initiating origin was removed");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("completePasswordReset with a bad token", function() {
    xhr.useResult("invalid");

    lib.completePasswordReset("token", "password", function onSuccess(info) {
      equal(info.valid, false, "bad token calls onSuccess with a false validity");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("completePasswordReset with an XHR failure", function() {
    xhr.useResult("ajaxError");

    lib.completePasswordReset(
      "token",
      "password",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("requestEmailReverify with owned unverified email - false status", function() {
    storage.addEmail(TEST_EMAIL);

    var returnTo = "http://samplerp.org";
    lib.setReturnTo(returnTo);
    lib.requestEmailReverify(TEST_EMAIL, function(status) {
      equal(status.success, true, "password reset for known user");
      equal(storage.getReturnTo(), returnTo, "RP URL is stored for verification");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("requestEmailReverify with unowned email - false status, invalid_user", function() {
    lib.requestEmailReverify(TEST_EMAIL, function(status) {
      testObjectValuesEqual(status, {
        success: false,
        reason: "invalid_email"
      });
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("requestEmailReverify owned email with throttle - false status, throttle", function() {
    xhr.useResult("throttle");
    storage.addEmail(TEST_EMAIL);

    lib.requestEmailReverify(TEST_EMAIL, function(status) {
      testObjectValuesEqual(status, {
        success: false,
        reason: "throttle"
      });
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("requestEmailReverify with XHR failure", function() {
    storage.addEmail(TEST_EMAIL);
    failureCheck(lib.requestEmailReverify, TEST_EMAIL);
  });

  asyncTest("authenticate with valid credentials, also syncs email with server", function() {
    lib.authenticate(TEST_EMAIL, "testuser", function(authenticated) {
      equal(true, authenticated, "we are authenticated!");
      var emails = lib.getStoredEmailKeypairs();
      equal(_.size(emails) > 0, true, "emails have been synced to server");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("authenticate with invalid credentials", function() {
    xhr.useResult("invalid");
    lib.authenticate(TEST_EMAIL, "testuser", function onComplete(authenticated) {
      equal(false, authenticated, "invalid authentication.");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("authenticate with XHR failure", function() {
    failureCheck(lib.authenticate, TEST_EMAIL, "testuser");
  });

  asyncTest("authenticateWithAssertion with valid assertion", function() {
    lib.authenticateWithAssertion(TEST_EMAIL, "test_assertion", function(authenticated) {
      equal(true, authenticated, "we are authenticated!");
      var emails = lib.getStoredEmailKeypairs();
      equal(_.size(emails) > 0, true, "emails have been synced to server");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("authenticateWithAssertion with invalid assertion", function() {
    xhr.useResult("invalid");
    lib.authenticateWithAssertion(TEST_EMAIL, "test_assertion", function onComplete(authenticated) {
      equal(false, authenticated, "invalid authentication.");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("authenticateWithAssertion with XHR failure", function() {
    failureCheck(lib.authenticateWithAssertion, TEST_EMAIL, "testuser");
  });

  asyncTest("checkAuthentication with valid authentication", function() {
    storage.addEmail(TEST_EMAIL);
    xhr.setContextInfo("auth_level", "assertion");

    lib.checkAuthentication(function(authenticated) {
      equal(authenticated, "assertion", "We are authenticated!");
      testNotUndefined(storage.getEmail(TEST_EMAIL), "localStorage is not cleared");
      start();
    });
  });



  asyncTest("checkAuthentication with invalid authentication - localStorage cleared", function() {
    storage.addEmail(TEST_EMAIL);
    xhr.setContextInfo("auth_level", undefined);

    lib.checkAuthentication(function(authenticated) {
      equal(authenticated, false, "We are not authenticated!");
      testUndefined(storage.getEmail(TEST_EMAIL), "localStorage was cleared");
      start();
    });
  });


  asyncTest("checkAuthentication with cookies disabled - localStorage is not cleared, user can enable their cookies and try again", function() {
    storage.addEmail(TEST_EMAIL);
    network.init({ cookiesEnabledOverride: false });

    lib.checkAuthentication(function(authenticated) {
      equal(authenticated, false, "We are not authenticated!");
      testNotUndefined(storage.getEmail(TEST_EMAIL), "localStorage is not cleared");
      start();
    });
  });

  asyncTest("checkAuthentication with XHR failure", function() {
    xhr.useResult("contextAjaxError");
    failureCheck(lib.checkAuthentication);
  });



  asyncTest("checkAuthenticationAndSync with valid authentication", function() {
    xhr.setContextInfo("auth_level", "assertion");

    lib.checkAuthenticationAndSync(function(authenticated) {
      equal(authenticated, "assertion", "We are authenticated!");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("checkAuthenticationAndSync with invalid authentication - localStorage cleared", function() {
    storage.addEmail(TEST_EMAIL);
    xhr.setContextInfo("auth_level", undefined);

    lib.checkAuthenticationAndSync(function onComplete(authenticated) {
      equal(authenticated, false, "We are not authenticated!");
      testUndefined(storage.getEmail(TEST_EMAIL), "localStorage was cleared");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("checkAuthenticationAndSync with cookies disabled - localStorage not cleared, user can enable their cookies and try again", function() {
    storage.addEmail(TEST_EMAIL);
    network.init({ cookiesEnabledOverride: false });

    lib.checkAuthenticationAndSync(function onComplete(authenticated) {
      equal(authenticated, false, "We are not authenticated!");
      testNotUndefined(storage.getEmail(TEST_EMAIL), "localStorage is not cleared");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("checkAuthenticationAndSync with XHR failure", function() {
    xhr.setContextInfo("auth_level", "assertion");

    failureCheck(lib.checkAuthenticationAndSync);
  });

  asyncTest("isEmailRegistered with registered email", function() {
    lib.isEmailRegistered("registered@testuser.com", function(registered) {
      ok(registered);
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("isEmailRegistered with unregistered email", function() {
    lib.isEmailRegistered("unregistered@testuser.com", function(registered) {
      equal(registered, false);
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("isEmailRegistered with XHR failure", function() {
    failureCheck(lib.isEmailRegistered, "registered@testuser.com");
  });

  asyncTest("passwordNeededToAddSecondaryEmail, account only has primaries - call callback with true", function() {
    xhr.setContextInfo("has_password", false);

    lib.passwordNeededToAddSecondaryEmail(function(passwordNeeded) {
      equal(passwordNeeded, true, "password correctly needed");
      start();
    });
  });

  asyncTest("passwordNeededToAddSecondaryEmail, account already has secondary - call callback with false", function() {
    xhr.setContextInfo("has_password", true);

    lib.passwordNeededToAddSecondaryEmail(function(passwordNeeded) {
      equal(passwordNeeded, false, "password not needed");
      start();
    });
  });

  asyncTest("passwordNeededToAddSecondaryEmail, mix of types - call callback with false", function() {
    xhr.setContextInfo("has_password", true);

    lib.passwordNeededToAddSecondaryEmail(function(passwordNeeded) {
      equal(passwordNeeded, false, "password not needed");
      start();
    });
  });

  asyncTest("addEmail", function() {
    var returnTo = "http://samplerp.org";
    lib.setReturnTo(returnTo);

    lib.addEmail("testemail@testemail.com", "password", function(added) {
      ok(added, "user was added");

      var identities = lib.getStoredEmailKeypairs();
      equal("testemail@testemail.com" in identities, false, "new email is not added until confirmation.");

      equal(storage.getReturnTo(), returnTo, "RP URL is stored for verification");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("addEmail with addition refused", function() {
    xhr.useResult("throttle");

    lib.addEmail("testemail@testemail.com", "password", function(added) {
      equal(added, false, "user addition was refused");

      var identities = lib.getStoredEmailKeypairs();
      equal(false, "testemail@testemail.com" in identities, "Our new email is not added until confirmation.");

      equal(typeof storage.getReturnTo(), "undefined", "initiatingOrigin is not stored");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("addEmail with XHR failure", function() {
    failureCheck(lib.addEmail, "testemail@testemail.com", "password");
  });


 asyncTest("waitForEmailValidation with `complete` backend response, user authenticated to assertion level - expect 'mustAuth'", function() {
    testAddressVerificationPoll("password", "complete", "waitForEmailValidation", "complete");
  });

  asyncTest("waitForEmailValidation with assertion authentication, complete from backend - return mustAuth status", function() {
    testAddressVerificationPoll("assertion", "complete", "waitForEmailValidation", "mustAuth");
  });

  asyncTest("waitForEmailValidation `mustAuth` response", function() {
    testAddressVerificationPoll("assertion", "mustAuth", "waitForEmailValidation", "mustAuth");
  });

  asyncTest("waitForEmailValidation with `noRegistration` response", function() {
    storage.setReturnTo(testOrigin);
    xhr.useResult("noRegistration");

    lib.waitForEmailValidation(
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      function(status) {
        ok(storage.getReturnTo(), "staged on behalf of is cleared when validation completes");
        ok(status, "noRegistration", "noRegistration response causes failure");
        start();
      });
  });


 asyncTest("waitForEmailValidation XHR failure", function() {
    storage.setReturnTo(testOrigin);
    xhr.useResult("ajaxError");

    lib.waitForEmailValidation(
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });


  asyncTest("cancelEmailValidation: ~1 second", function() {
    xhr.useResult("pending");

    storage.setReturnTo(testOrigin);
    lib.waitForEmailValidation(
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      testHelpers.unexpectedXHRFailure
    );

    setTimeout(function() {
      lib.cancelUserValidation();
      ok(storage.getReturnTo(), "staged on behalf of is not cleared when validation cancelled");
      start();
    }, 500);
  });

  asyncTest("verifyEmail with a good token - callback with email, returnTo, valid", function() {
    storage.setReturnTo(testOrigin);
    storage.addEmail(TEST_EMAIL);
    lib.verifyEmail("token", "password", function onSuccess(info) {
      testObjectValuesEqual(info, {
        valid: true,
        email: TEST_EMAIL,
        returnTo: testOrigin
      });
      equal(storage.getReturnTo(), "", "initiating returnTo was removed");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("verifyEmail with a bad token - callback with valid: false", function() {
    xhr.useResult("invalid");

    lib.verifyEmail("token", "password", function onSuccess(info) {
      equal(info.valid, false, "bad token calls onSuccess with a false validity");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("verifyEmail with an XHR failure", function() {
    xhr.useResult("ajaxError");

    lib.verifyEmail(
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
    lib.syncEmailKeypair(
      "testemail@testemail.com",
      testHelpers.unexpectedSuccess,
      function() {
        var identity = lib.getStoredEmailKeypair("testemail@testemail.com");
        equal(typeof identity, "undefined", "Invalid email is not synced");

        start();
      }
    );
  });

  asyncTest("syncEmailKeypair with XHR failure", function() {
    failureCheck(lib.syncEmailKeypair, "testemail@testemail.com");
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

    failureCheck(lib.removeEmail, "testemail@testemail.com");
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
      ok(TEST_EMAIL in identities, "Our new email is added");
      equal(_.size(identities), 1, "there is one identity");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("syncEmails with identities preloaded and none to add", function() {
    storage.addEmail(TEST_EMAIL);
    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok(TEST_EMAIL in identities, "Our new email is added");
      equal(_.size(identities), 1, "there is one identity");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("syncEmails with identities preloaded and one to add", function() {
    storage.addEmail(TEST_EMAIL, {pubkey: pubkey, cert: random_cert});

    xhr.useResult("multiple");

    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok(TEST_EMAIL in identities, "Our old email address is still there");
      ok("testuser2@testuser.com" in identities, "Our new email is added");

      equal(_.size(identities), 2, "there are two identities");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("syncEmails with identities preloaded and one to remove", function() {
    storage.addEmail(TEST_EMAIL, {pub: pubkey, cert: random_cert});
    storage.addEmail("testuser2@testuser.com", {pub: pubkey, cert: random_cert});

    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok(TEST_EMAIL in identities, "Our old email address is still there");
      equal("testuser2@testuser.com" in identities, false, "Our unknown email is removed");
      equal(_.size(identities), 1, "there is one identity");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("syncEmails with XHR failure", function() {
    failureCheck(lib.syncEmails);
  });

  asyncTest("getAssertion with known email that has key", function() {
    lib.syncEmailKeypair(TEST_EMAIL, function() {
      lib.getAssertion(TEST_EMAIL, lib.getOrigin(), function onSuccess(assertion) {
        testAssertion(assertion, start);
        equal(storage.site.get(testOrigin, "email"), TEST_EMAIL, "email address was persisted");
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("getAssertion with known secondary email that does not have a key", function() {
    storage.addEmail(TEST_EMAIL, { type: "secondary" });
    lib.getAssertion(TEST_EMAIL, lib.getOrigin(), function onSuccess(assertion) {
      testAssertion(assertion, start);
      equal(storage.site.get(testOrigin, "email"), TEST_EMAIL, "email address was persisted");
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

  asyncTest("getAssertion with known primary email, expired cert, user not authenticated with IdP - expect null assertion", function() {
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
    lib.syncEmailKeypair(TEST_EMAIL, function() {
      lib.getAssertion("testuser2@testuser.com", lib.getOrigin(), function onSuccess(assertion) {
        equal(null, assertion, "email was unknown, we do not have an assertion");
        equal(storage.site.get(testOrigin, "email"), undefined, "email address was not set");
        start();
      });
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("getAssertion with XHR failure", function() {
    storage.addEmail(TEST_EMAIL, {});
    failureCheck(lib.getAssertion, TEST_EMAIL, lib.getOrigin());
  });


  asyncTest("getSilentAssertion with logged in user, emails match - user already logged in, call callback with email and null assertion", function() {
    var LOGGED_IN_EMAIL = TEST_EMAIL;
    xhr.setContextInfo("auth_level", "password");

    lib.syncEmailKeypair(LOGGED_IN_EMAIL, function() {
      storage.setLoggedIn(lib.getOrigin(), LOGGED_IN_EMAIL);
      lib.getSilentAssertion(LOGGED_IN_EMAIL, function(email, assertion) {
        equal(email, LOGGED_IN_EMAIL, "correct email");
        strictEqual(assertion, null, "correct assertion");
        start();
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("getSilentAssertion with logged in user, request email different from logged in email, valid cert for logged in email - logged in user needs assertion - call callback with email and assertion.", function() {
    xhr.setContextInfo("auth_level", "password");
    var LOGGED_IN_EMAIL = TEST_EMAIL;
    var REQUESTED_EMAIL = "requested@testuser.com";

    lib.syncEmailKeypair(LOGGED_IN_EMAIL, function() {
      storage.setLoggedIn(lib.getOrigin(), LOGGED_IN_EMAIL);
      lib.getSilentAssertion(REQUESTED_EMAIL, function(email, assertion) {
        equal(email, LOGGED_IN_EMAIL, "correct email");
        testAssertion(assertion, start);
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("logoutUser", function(onSuccess) {
    lib.authenticate(TEST_EMAIL, "testuser", function(authenticated) {
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
    lib.authenticate(TEST_EMAIL, "testuser", function(authenticated) {
      lib.syncEmails(function() {
        failureCheck(lib.logoutUser);
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("cancelUser", function(onSuccess) {
    lib.cancelUser(function() {
      var storedIdentities = storage.getEmails();
      equal(_.size(storedIdentities), 0, "All items have been removed");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("cancelUser with XHR failure", function(onSuccess) {
    failureCheck(lib.cancelUser);
  });


  asyncTest("logout with invalid login", function() {
    xhr.setContextInfo("auth_level", undefined);

    lib.logout(function onComplete(success) {
      strictEqual(success, false, "success with invalid login is false");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("logout with valid login with remember set to true", function() {
    xhr.setContextInfo("auth_level", "assertion");
    storage.site.set(testOrigin, "remember", true);

    lib.logout(function onComplete(success) {
      strictEqual(success, true, "success flag good");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("addressInfo with XHR Error", function() {
    failureCheck(lib.addressInfo, TEST_EMAIL);
  });

  asyncTest("addressInfo with unknown secondary user", function() {
    xhr.useResult("unknown_secondary");
    lib.addressInfo(
      "unregistered@testuser.com",
      function(info) {
        equal(info.email, "unregistered@testuser.com", "correct address");
        equal(info.type, "secondary", "correct type");
        equal(info.state, "unknown", "address not known to Persona");
        start();
      },
      testHelpers.unexpectedFailure
    );
  });

  asyncTest("addressInfo with known secondary user", function() {
    xhr.useResult("known_secondary");
    lib.addressInfo(
      "registered@testuser.com",
      function(info) {
        equal(info.type, "secondary", "correct type");
        equal(info.email, "registered@testuser.com", "correct email");
        equal(info.state, "known", "address known to Persona");
        start();
      },
      testHelpers.unexpectedFailure
    );
  });

  asyncTest("addressInfo with unknown primary authenticated user", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);
    lib.addressInfo(
      "unregistered@testuser.com",
      function(info) {
        testObjectValuesEqual(info, {
          type: "primary",
          email: "unregistered@testuser.com",
          authed: true,
          idpName: "testuser.com"
        });
        start();
      },
      testHelpers.unexpectedFailure
    );
  });

  asyncTest("addressInfo with known primary authenticated user", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);
    lib.addressInfo(
      "registered@testuser.com",
      function(info) {
        testObjectValuesEqual(info, {
          type: "primary",
          email: "registered@testuser.com",
          authed: true,
          idpName: "testuser.com"
        });
        start();
      },
      testHelpers.unexpectedFailure
    );
  });

  asyncTest("addressInfo with known primary unauthenticated user", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
    lib.addressInfo(
      "registered@testuser.com",
      function(info) {
        testObjectValuesEqual(info, {
          type: "primary",
          email: "registered@testuser.com",
          authed: false,
          idpName: "testuser.com"
        });
        start();
      },
      testHelpers.unexpectedFailure
    );
  });

  // JWCrypto relies on there being a random seed.  The random seed is
  // gotten whenever network.withContext is called.  Since this is
  // supposed to mock the cert clearing step...
  // add a random seed to ensure that we can get our keypair.
  jwcrypto.addEntropy("H+ZgKuhjVckv/H4i0Qvj/JGJEGDVOXSIS5RCOjY9/Bo=");
  function makeCert(email, issuer, cb) {
    var opts = {algorithm: "DS", keysize: 256};
    jwcrypto.generateKeypair(opts, function (err, keyPair) {
      ok(!err, "We can generate a keypair");
      // We don't care about idPSecretKey... reuse user's keyPair here
      var idpSecretKey = keyPair.secretKey;

      jwcrypto.cert.sign({
        publicKey: keyPair.publicKey,
        principal: {email: email}
      }, {
        issuer: issuer, expiresAt: new Date() + 10000, issuedAt: new Date()}, null, idpSecretKey, function (err, cert) {
          ok(!err, "We can create a cert");
          cb(cert);
        });
    });
  }

  asyncTest("checkEmailIssuer with changing issuer", function () {
    var emailAddr = "registered@testuser.com";
    makeCert(emailAddr, "secondary.domain", function (cert) {
      storage.addEmail(emailAddr, { cert: cert });
      ok(storage.getEmail(emailAddr).cert, "cert exists");
      xhr.useResult("primary");
      provisioning.setStatus(provisioning.AUTHENTICATED);
      var newInfo = lib.checkEmailIssuer(emailAddr, {
        email: emailAddr,
        // new issuer
        type: "secondary",
        issuer: "testuser.com",
        state: "transition_to_primary"
      });
      ok(!storage.getEmail(emailAddr).cert, "cert was cleared up");
      start();
    });
  });

  asyncTest("setComputerOwnershipStatus with true, isUsersComputer - mark the computer as the users, prolongs the user's session", function() {
    lib.authenticate(TEST_EMAIL, "password", function() {
      storage.usersComputer.clear(network.userid());
      lib.setComputerOwnershipStatus(true, function() {
        lib.isUsersComputer(function(usersComputer) {
          equal(usersComputer, true, "user is marked as owner of computer");
          start();
        }, testHelpers.unexpectedXHRFailure);
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("setComputerOwnershipStatus with false, isUsersComputer - mark the computer as not the users", function() {
    lib.authenticate(TEST_EMAIL, "password", function() {
      storage.usersComputer.clear(network.userid());
      lib.setComputerOwnershipStatus(false, function() {
        lib.isUsersComputer(function(usersComputer) {
          equal(usersComputer, false, "user is marked as not an owner");
          start();
        }, testHelpers.unexpectedXHRFailure);
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("setComputerOwnershipStatus with unauthenticated user - call onFailure", function() {
    lib.setComputerOwnershipStatus(false,
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("setComputerOwnershipStatus with true & XHR Failure - call onFailure", function() {
    lib.authenticate(TEST_EMAIL, "password", function() {
      xhr.useResult("ajaxError");
      lib.setComputerOwnershipStatus(true,
        testHelpers.unexpectedSuccess,
        testHelpers.expectedXHRFailure
      );
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("shouldAskIfUsersComputer with user who has been asked - call onSuccess with false", function() {
    lib.authenticate(TEST_EMAIL, "password", function() {
      storage.usersComputer.setConfirmed(network.userid());
      lib.shouldAskIfUsersComputer(function(shouldAsk) {
        equal(shouldAsk, false, "user has been asked already, do not ask again");
        start();
      }, testHelpers.expectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("shouldAskIfUsersComputer with user who has not been asked and has not verified email this dialog session - call onSuccess with true", function() {
    lib.authenticate(TEST_EMAIL, "password", function() {
      storage.usersComputer.forceAsk(network.userid());
      lib.shouldAskIfUsersComputer(function(shouldAsk) {
        equal(shouldAsk, true, "user has not verified an email this dialog session and should be asked");
        start();
      }, testHelpers.expectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("shouldAskIfUsersComputer with user who has not been asked and has verified email in this dialog session - call onSuccess with false", function() {
    lib.authenticate(TEST_EMAIL, "password", function() {
      storage.setReturnTo(testOrigin);
      xhr.useResult("complete");

      lib.waitForEmailValidation(TEST_EMAIL, function() {
        storage.usersComputer.forceAsk(network.userid());
        lib.shouldAskIfUsersComputer(function(shouldAsk) {
          equal(shouldAsk, false, "user has verified an email this dialog session and should be asked");
          start();
        }, testHelpers.expectedXHRFailure);
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("usedAddressAsPrimary successfully calls wsapi", function () {
    lib.authenticate(TEST_EMAIL, "password", function() {
      xhr.useResult("primaryTransition");
      lib.usedAddressAsPrimary(TEST_EMAIL, function (status) {
        ok(status.success);
        start();
      }, testHelpers.unexpectedXHRFailure);
    });

  });

  asyncTest("usedAddressAsPrimary successfully calls wsapi, but can receive no-op", function () {
    lib.authenticate(TEST_EMAIL, "password", function() {
      xhr.useResult("primary");
      lib.usedAddressAsPrimary(TEST_EMAIL, function (status) {
        equal(status.success, false);
        start();
      }, testHelpers.unexpectedXHRFailure);
    });
  });


  /**
   * XXX - These are copied from the password reset flows which are going to
   * change. The completion, waitFor and cancelWaitFor tests can probably be
   * generalized and combined with other tests.
   */
  asyncTest("requestTransitionToSecondary with known email - true status", function() {
    var returnTo = "http://samplerp.org";
    lib.setReturnTo(returnTo);

    lib.requestTransitionToSecondary("registered@testuser.com", "password", function(status) {
      equal(status.success, true, "password reset for known user");
      equal(storage.getReturnTo(), returnTo, "RP URL is stored for verification");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("requestTransitionToSecondary with unknown email - false status, invalid_user", function() {
    lib.requestTransitionToSecondary("unregistered@testuser.com", "password", function(status) {
      equal(status.success, false, "password not reset for unknown user");
      equal(status.reason, "invalid_user", "invalid_user is the reason");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("requestTransitionToSecondary with throttle - false status, throttle", function() {
    xhr.useResult("throttle");
    lib.requestTransitionToSecondary("registered@testuser.com", "password", function(status) {
      equal(status.success, false, "password not reset for throttle");
      equal(status.reason, "throttle", "password reset was throttled");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("requestTransitionToSecondary with XHR failure", function() {
    failureCheck(lib.requestTransitionToSecondary, "registered@testuser.com", "password");
  });

  asyncTest("completeTransitionToSecondary with a good token", function() {
    storage.addEmail(TEST_EMAIL);
    storage.setReturnTo(testOrigin);

    lib.completeTransitionToSecondary("token", "password", function onSuccess(info) {
      testObjectValuesEqual(info, {
        valid: true,
        email: TEST_EMAIL,
        returnTo: testOrigin
      });

      equal(storage.getReturnTo(), "", "initiating origin was removed");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("completeTransitionToSecondary with a bad token", function() {
    xhr.useResult("invalid");

    lib.completeTransitionToSecondary("token", "password", function onSuccess(info) {
      equal(info.valid, false, "bad token calls onSuccess with a false validity");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("completeTransitionToSecondary with an XHR failure", function() {
    xhr.useResult("ajaxError");

    lib.completeTransitionToSecondary(
      "token",
      "password",
      testHelpers.unexpectedSuccess,
      testHelpers.expectedXHRFailure
    );
  });

  asyncTest("waitForTransitionToSecondaryComplete with no authentication & complete backend response - `mustAuth` response", function() {
    testAddressVerificationPoll(undefined, "complete", "waitForTransitionToSecondaryComplete", "mustAuth");
  });

  asyncTest("waitForTransitionToSecondaryComplete with assertion authentication & complete backend response - `mustAuth` response", function() {
    testAddressVerificationPoll("assertion", "complete", "waitForTransitionToSecondaryComplete", "mustAuth");
  });

  asyncTest("waitForTransitionToSecondaryComplete with password authentication - `complete` response", function() {
    testAddressVerificationPoll("password", "complete", "waitForTransitionToSecondaryComplete", "complete");
  });

  asyncTest("waitForTransitionToSecondaryComplete with `mustAuth` response", function() {
    testAddressVerificationPoll(undefined, "mustAuth", "waitForTransitionToSecondaryComplete", "mustAuth");
  });

  asyncTest("waitForTransitionToSecondaryComplete with `noRegistration` response", function() {
    xhr.useResult("noRegistration");

    storage.setReturnTo(testOrigin);
    lib.waitForTransitionToSecondaryComplete(
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      function(status) {
        ok(storage.getReturnTo(), "staged on behalf of is not cleared for noRegistration response");
        ok(status, "noRegistration", "noRegistration response causes failure");
        start();
      }
    );
  });


  asyncTest("waitForTransitionToSecondaryComplete with XHR failure", function() {
    storage.setReturnTo(testOrigin);
    xhr.useResult("ajaxError");
    lib.waitForTransitionToSecondaryComplete(
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      function() {
        ok(storage.getReturnTo(), "staged on behalf of is not cleared on XHR failure");
        ok(true, "xhr failure should always be a failure");
        start();
      }
    );
  });

  asyncTest("cancelWaitForTransitionToSecondaryComplete: ~1 second", function() {
    xhr.useResult("pending");

    storage.setReturnTo(testOrigin);
    // yes, we are neither expected succes nor failure because we are
    // cancelling the wait.
    lib.waitForTransitionToSecondaryComplete(
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      testHelpers.unexpectedXHRFailure
    );

    setTimeout(function() {
      lib.cancelWaitForTransitionToSecondaryComplete();
      ok(storage.getReturnTo(), "staged on behalf of is not cleared when validation cancelled");
      start();
    }, 500);
  });


}());
