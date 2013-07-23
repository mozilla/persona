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


  module("common/js/user", {
    setup: function() {
      testHelpers.setup();
      xhr.setContextInfo("auth_level", "password");
      xhr.setContextInfo("userid", 1);
    },
    teardown: function() {
      testHelpers.teardown();
    }
  });

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

  // These are generic tests for staging functions.
  // the staging function name should be passed in as stageFuncName.
  // config can take two parameters:
  //   password - if the staging function requires a password, enter it.
  //   require_valid_email - if true, indicates that a staging method
  //      requires that the email address already exist. An attempt will
  //      be made to stage an address that does not exist.
  function testStageAddress(stageFuncName, config) {
    function getStagingMethodArgs(email, onComplete, password) {
        var args = [email, onComplete, testHelpers.unexpectedXHRFailure];
        if (password) {
          args.splice(1, 0, password);
        }

        return args;
    }

    asyncTest(stageFuncName + " success - callback with true status",
        function() {
      storage.addEmail(TEST_EMAIL);

      var returnTo = "http://samplerp.org";
      lib.setReturnTo(returnTo);

      var onComplete = function(status) {
        ok(status.success, "address staged");
        equal(storage.getReturnTo(), returnTo, "RP URL is stored for "
            + "verification");
        start();
      };

      lib[stageFuncName].apply(lib, getStagingMethodArgs(TEST_EMAIL,
          onComplete, config.password));
    });

    asyncTest(stageFuncName + " throttled - callback with false status",
        function() {
      xhr.useResult("throttle");

      storage.addEmail("registered@testuser.com");

      var onComplete = function(status) {
        testObjectValuesEqual(status, {
          success: false,
          reason: "throttle"
        });
        start();
      };

      lib[stageFuncName].apply(lib,
          getStagingMethodArgs("registered@testuser.com", onComplete,
          config.password));
    });

    if (config.require_valid_email) {
      asyncTest(stageFuncName + " with unknown email - false status",
          function() {

        var onComplete = function(status) {
          equal(status.success, false, "failure for unknown user");
          equal(status.reason, "invalid_email", "correct reason");
          start();
        };

        lib[stageFuncName].apply(lib,
            getStagingMethodArgs("unregistered@testuser.com",
            onComplete, config.password));
      });
    }

    asyncTest(stageFuncName + " with XHR failure", function() {
      storage.addEmail(TEST_EMAIL);
      var args = [lib[stageFuncName], TEST_EMAIL];
      if (config.password) args.push(config.password);

      failureCheck.apply(null, args);
    });
  }

  function testAddressVerificationPoll(authLevel, xhrResultName, pollFuncName, expectedResult) {
    lib.clearContext();
    storage.setReturnTo(testOrigin);
    xhr.useResult(xhrResultName);

    xhr.setContextInfo("auth_level", authLevel);
    lib[pollFuncName]("registered@testuser.com", function(status) {
      ok(!storage.getReturnTo(), "staged on behalf of is cleared when validation completes");
      equal(status, expectedResult, expectedResult + " response expected");

      if (authLevel || expectedResult === "complete") {
        // after completion, the userid must be set. See issue #3172
        ok(lib.userid());

        // synced_address should be added as a result of syncing email
        // addresses when the verification poll completes. See issue #3178
        testHelpers.testAddressesSyncedAfterUserRegistration();
      }

      start();
    }, testHelpers.unexpectedXHRFailure);
  }

  function testAddressVerificationPollNoRegistration(pollFuncName) {
    xhr.useResult("noRegistration");

    storage.setReturnTo(testOrigin);
    lib[pollFuncName](
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      function(status) {
        ok(storage.getReturnTo(), "staged on behalf of is not cleared for noRegistration response");
        ok(status, "noRegistration", "noRegistration response causes failure");
        start();
      }
    );
  }

  function testAddressVerificationPollXHRFailure(waitFuncName) {
    storage.setReturnTo(testOrigin);
    xhr.useResult("ajaxError");
    lib[waitFuncName](
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      function() {
        ok(storage.getReturnTo(), "staged on behalf of is not cleared on XHR failure");
        ok(true, "xhr failure should always be a failure");
        start();
      }
    );
  }


  function testCancelAddressVerification(waitFuncName, cancelFuncName) {
    xhr.useResult("pending");

    storage.setReturnTo(testOrigin);
    // yes, we are neither expected succes nor failure because we are
    // cancelling the wait.
    lib[waitFuncName](
      "registered@testuser.com",
      testHelpers.unexpectedSuccess,
      testHelpers.unexpectedXHRFailure
    );

    setTimeout(function() {
    lib[cancelFuncName]();
    ok(storage.getReturnTo(), "staged on behalf of is not cleared when validation cancelled");
      start();
    }, 500);
  }


  function testVerificationPoll(waitFuncName, cancelFuncName) {
    // If the user is for some reason not authed after verifying an address,
    // they must enter their password.
    asyncTest(waitFuncName + " with no authentication & complete backend response - `mustAuth` response", function() {
      testAddressVerificationPoll(undefined, "complete", waitFuncName, "mustAuth");
    });

    // If the user is only authed to the assertion level after verifying an
    // address, they must enter their password. This can happen if the user is
    // authed to the assertion level and verifies in a second browser. The
    // backend still gives a response of "complete" but then cert_key fails
    // when trying to certify a key for a secondary. DOH.
    asyncTest(waitFuncName + " with assertion authentication & complete backend response - `mustAuth` response", function() {
      testAddressVerificationPoll("assertion", "complete", waitFuncName, "mustAuth");
    });

    // User is authed to the password level, they are A-OK.
    asyncTest(waitFuncName + " with password authentication - `complete` response", function() {
      testAddressVerificationPoll("password", "complete", waitFuncName, "complete");
    });

    // User received an explicit "mustAuth" response from the backend. They
    // have to enter their password.
    asyncTest(waitFuncName + " with `mustAuth` response", function() {
      testAddressVerificationPoll(undefined, "mustAuth", waitFuncName, "mustAuth");
    });

    asyncTest(waitFuncName + " with `noRegistration` response", function() {
      testAddressVerificationPollNoRegistration(waitFuncName);
    });


    asyncTest(waitFuncName + " with XHR failure", function() {
      testAddressVerificationPollXHRFailure(waitFuncName);
    });

    asyncTest(cancelFuncName + ": ~1 second", function() {
      testCancelAddressVerification(waitFuncName, cancelFuncName);
    });

  }


  function testVerificationComplete(completeFuncName) {
    asyncTest(completeFuncName + " with a good token", function() {
      storage.addEmail(TEST_EMAIL);
      storage.setReturnTo(testOrigin);

      lib[completeFuncName]("token", "password", function onSuccess(info) {
        testObjectValuesEqual(info, {
          valid: true,
          email: TEST_EMAIL,
          returnTo: testOrigin
        });

        equal(storage.getReturnTo(), "", "initiating origin was removed");

        start();
      }, testHelpers.unexpectedXHRFailure);
    });

    asyncTest(completeFuncName + " with a bad token", function() {
      xhr.useResult("invalid");

      lib[completeFuncName]("token", "password", function onSuccess(info) {
        equal(info.valid, false, "bad token calls onSuccess with a false validity");
        start();
      }, testHelpers.unexpectedXHRFailure);
    });

    asyncTest(completeFuncName + " with an XHR failure", function() {
      xhr.useResult("ajaxError");

      lib[completeFuncName](
        "token",
        "password",
        testHelpers.unexpectedSuccess,
        testHelpers.expectedXHRFailure
      );
    });
  }

  // This is the configurationf or the staging tests.
  var stagingTests = {
    testCreateUser: {
      stageAddress: {
        stageFunction: "createSecondaryUser",
        config: { password: "password" }
      },
      pollingFunction: "waitForUserValidation",
      cancelPollingFunction: "cancelUserValidation",
      verificationFunction: "verifyUser"
    },

    testAddEmail: {
      stageAddress: {
        stageFunction: "addEmail",
        config: { password: "password" }
      },
      pollingFunction: "waitForEmailValidation",
      cancelPollingFunction: "cancelEmailValidation",
      verificationFunction: "verifyEmail"
    },

    testResetPassword: {
      stageAddress: {
        stageFunction: "requestPasswordReset",
        config: { require_valid_email: true }
      },
      pollingFunction: "waitForPasswordResetComplete",
      cancelPollingFunction: "cancelWaitForPasswordResetComplete",
      verificationFunction: "completePasswordReset"
    },

    testReverifyEmail: {
      stageAddress: {
        stageFunction: "requestEmailReverify",
        config: { require_valid_email: true }
      },
      pollingFunction: "waitForEmailReverifyComplete",
      cancelPollingFunction: "cancelWaitForEmailReverifyComplete"
    },

    testTransitionToSecondary: {
      stageAddress: {
        stageFunction: "requestTransitionToSecondary",
        config: {
          password: "password",
          require_valid_email: true
        }
      },
      pollingFunction: "waitForTransitionToSecondaryComplete",
      cancelPollingFunction: "cancelWaitForTransitionToSecondaryComplete",
      verificationFunction: "completeTransitionToSecondary"
    }
  };

  for (var key in stagingTests) {
    var testConfig = stagingTests[key];

    var stageAddressConfig = testConfig.stageAddress;
    testStageAddress(stageAddressConfig.stageFunction, stageAddressConfig.config);

    testVerificationPoll(testConfig.pollingFunction,
        testConfig.cancelPollingFunction);

    if (testConfig.verificationFunction) {
      testVerificationComplete(testConfig.verificationFunction);
    }
  }

  function testKnownSecondaryUser(email, normalizedEmail) {
    lib.addressInfo(
      email,
      function(info) {
        testObjectValuesEqual(info, {
          type: "secondary",
          email: normalizedEmail,
          state: "known"
        });
        start();
      },
      testHelpers.unexpectedFailure
    );
  }

  function testAuthenticatedPrimaryUser(email, normalizedEmail) {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);
    lib.addressInfo(
      email,
      function(info) {
        testObjectValuesEqual(info, {
          type: "primary",
          email: normalizedEmail,
          authed: true,
          idpName: "testuser.com"
        });
        start();
      },
      testHelpers.unexpectedFailure
    );
  }

  function testUnauthenticatedPrimaryUser(email, normalizedEmail) {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
    lib.addressInfo(
      email,
      function(info) {
        testObjectValuesEqual(info, {
          type: "primary",
          email: normalizedEmail,
          authed: false,
          idpName: "testuser.com"
        });
        start();
      },
      testHelpers.unexpectedFailure
    );
  }


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

  asyncTest("createPrimaryUser with primary, user verified with primary - expect 'primary.verified'", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);
    lib.createPrimaryUser({email: "unregistered@testuser.com"}, function(status) {
      equal(status, "primary.verified", "primary user is already verified, correct status");
      lib.checkAuthentication(function(authenticated) {
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

  asyncTest("createPrimaryUser with primary, unknown provisioning failure - expect primary.verify", function() {
    xhr.useResult("primary");

    provisioning.setFailure({
      code: "primaryError",
      msg: "some error"
    });

    lib.createPrimaryUser({email: "unregistered@testuser.com"}, function(status) {
      equal(status, "primary.verify", "primary must verify with primary, correct status");
      start();
    }, testHelpers.expectedXHRFailure);
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

  asyncTest("authenticate with valid normal credentials, syncs email with server", function() {
    lib.authenticate(TEST_EMAIL, "testuser", function(authenticated) {
      equal(true, authenticated, "we are authenticated!");
      var emails = lib.getStoredEmailKeypairs();
      equal(_.size(emails) > 0, true, "emails have been synced to server");
      // user is not authenticating with a forever session, they should be
      // still be asked whether this is their computer.
      equal(storage.usersComputer.confirmed(lib.userid()), false);
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("authenticate with valid forever session credentials", function() {
    xhr.useResult("foreverSession");
    lib.authenticate(TEST_EMAIL, "testuser", function(authenticated) {
      // user is authenticating with a forever session, they should be marked
      // as "confirmed"
      equal(storage.usersComputer.confirmed(lib.userid()), true);
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
      equal(storage.usersComputer.confirmed(lib.userid()), false);
      start();
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("authenticateWithAssertion with valid assertion and a forever session", function() {
    xhr.useResult("foreverSession");
    lib.authenticateWithAssertion(TEST_EMAIL, "test_assertion", function(authenticated) {
      equal(true, authenticated, "we are authenticated!");
      equal(storage.usersComputer.confirmed(lib.userid()), true);
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
    network.cookiesEnabledOverride = false;

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
    network.cookiesEnabledOverride = false;

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

  asyncTest("syncEmailKeypair with successful sync", function() {
    lib.syncEmailKeypair("testuser@testuser.com", function(keypair) {
      var identity = lib.getStoredEmailKeypair("testuser@testuser.com");

      ok(identity, "we have an identity");
      ok(identity.priv, "a private key is on the identity");
      ok(identity.pub, "a private key is on the identity");

      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("syncEmailKeypair with invalid sync", function() {
    xhr.useResult("invalid");
    lib.syncEmailKeypair(
      "testuser@testuser.com",
      testHelpers.unexpectedSuccess,
      function() {
        var identity = lib.getStoredEmailKeypair("testuser@testuser.com");
        equal(typeof identity, "undefined", "Invalid email is not synced");

        start();
      }
    );
  });

  asyncTest("syncEmailKeypair with XHR failure", function() {
    failureCheck(lib.syncEmailKeypair, "testuser@testuser.com");
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

  asyncTest("syncEmails with one invalid cert preloaded and none to add - remove expired cert but not identity", function() {
    storage.addEmail(TEST_EMAIL, {
      cert: "bad cert that should be removed when certs are checked"
    });

    lib.syncEmails(function onSuccess() {
      var records = lib.getStoredEmailKeypairs();

      ok(TEST_EMAIL in records, "Our new email is added");
      equal(_.size(records), 1, "there is one identity");

      // cert was invalid and should be wiped.
      var identity = records[TEST_EMAIL];
      equal("cert" in identity, false);

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

  asyncTest("syncEmails, could not get context - call error", function() {
    xhr.useResult("contextAjaxError");
    failureCheck(lib.syncEmails);
  });


  asyncTest("getAssertion with known email that has key", function() {
    lib.syncEmailKeypair(TEST_EMAIL, function() {
      lib.getAssertion(TEST_EMAIL, lib.getOrigin(), function onSuccess(assertion) {
        testAssertion(assertion, start);
        equal(storage.site.get(testOrigin, "email"), TEST_EMAIL, "email address was persisted");
        // issuer is used when getting a silent assertion.
        equal(storage.site.get(testOrigin, "issuer"), "default", "issuer was persisted");
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
    storage.addEmail("registered@testuser.com", { type: "primary" });

    lib.getAssertion(
      "registered@testuser.com",
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

  asyncTest("getSilentAssertion with logged out user, " +
    "null email and assertion",
      function() {
    xhr.setContextInfo("auth_level", false);

    lib.getSilentAssertion("logged_in@testuser.com",
        function(email, assertion) {
      strictEqual(email, null, "correct email");
      strictEqual(assertion, null, "correct assertion");
      start();
    }, testHelpers.unexpectedXHRFailure);
  });


  asyncTest("getSilentAssertion with logged in user, emails match, " +
      "no transition - email and null assertion",  function() {
    var LOGGED_IN_EMAIL = TEST_EMAIL;
    xhr.setContextInfo("auth_level", "password");

    lib.syncEmailKeypair(LOGGED_IN_EMAIL, function() {
      storage.site.set(lib.getOrigin(), "logged_in", LOGGED_IN_EMAIL);

      lib.getSilentAssertion(LOGGED_IN_EMAIL, function(email, assertion) {
        equal(email, LOGGED_IN_EMAIL, "correct email");
        strictEqual(assertion, null, "correct assertion");
        start();
      }, testHelpers.unexpectedXHRFailure);
    });
  });

  function testTransitionAddressSilentAssertion() {
    xhr.setContextInfo("auth_level", "password");
    storage.addEmail(TEST_EMAIL, {});
    storage.site.set(lib.getOrigin(), "logged_in", TEST_EMAIL);

    lib.getSilentAssertion("logged_in@testuser.com",
        function(email, assertion) {
      strictEqual(email, null, "correct email");
      strictEqual(assertion, null, "correct assertion");
      start();
    }, testHelpers.unexpectedXHRFailure);
  }


  asyncTest("getSilentAssertion with logged in user, emails different, " +
      "primaryTransition - null email and assertion",
      function() {
    xhr.useResult("primaryTransition");

    testTransitionAddressSilentAssertion();
  });

  asyncTest("getSilentAssertion with logged in user, emails different, " +
      "secondaryTransition - null email and assertion",
      function() {
    xhr.useResult("secondaryTransition");

    testTransitionAddressSilentAssertion();
  });

  asyncTest("getSilentAssertion with logged in user, emails different, " +
      "secondaryTransitionPassword - null email and assertion",
      function() {
    xhr.useResult("secondaryTransitionPassword");

    testTransitionAddressSilentAssertion();
  });

  asyncTest("getSilentAssertion with logged in user, request email different from logged in email, valid cert for logged in email - logged in user needs assertion - call callback with email and assertion.", function() {
    xhr.setContextInfo("auth_level", "password");
    var LOGGED_IN_EMAIL = TEST_EMAIL;
    var REQUESTED_EMAIL = "requested@testuser.com";

    lib.syncEmailKeypair(LOGGED_IN_EMAIL, function() {
      storage.site.set(lib.getOrigin(), "logged_in", LOGGED_IN_EMAIL);
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
        failureCheck(401, lib.logoutUser);
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
    testKnownSecondaryUser("registered@testuser.com",
        "registered@testuser.com");
  });

  asyncTest("addressInfo with known secondary user who typed address with wrong case", function() {
    testKnownSecondaryUser("REGISTERED@TESTUSER.COM",
        "registered@testuser.com");
  });

  asyncTest("addressInfo with unknown primary authenticated user", function() {
    testAuthenticatedPrimaryUser("unregistered@testuser.com",
        "unregistered@testuser.com");
  });

  asyncTest("addressInfo with known primary authenticated user", function() {
    testAuthenticatedPrimaryUser("registered@testuser.com",
        "registered@testuser.com");
  });

  asyncTest("addressInfo with known primary unauthenticated user", function() {
    testUnauthenticatedPrimaryUser("registered@testuser.com",
        "registered@testuser.com");
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

  function testCertCleared(startIssuer, addressInfo, unverified) {
    var emailAddr = "registered@testuser.com";
    makeCert(emailAddr, startIssuer, function (cert) {
      storage.addEmail(emailAddr, { cert: cert, unverified: unverified });
      addressInfo.email = emailAddr;
      lib.checkForInvalidCerts(emailAddr, addressInfo, function(newInfo) {
        ok(!storage.getEmail(emailAddr).cert, "cert was cleared up");
        start();
      });
    });
  }

  asyncTest("checkForInvalidCerts with transition_to_primary", function () {
    testCertCleared("secondary.domain", {
      type: "primary",
      issuer: "testuser.com",
      state: "transition_to_primary"
    });
  });

  asyncTest("checkForInvalidCerts with transition_to_secondary", function () {
    testCertCleared("primary.domain", {
      type: "secondary",
      issuer: "login.persona.org",
      state: "transition_to_secondary"
    });
  });

  asyncTest("checkForInvalidCerts with transition_no_password", function () {
    testCertCleared("primary.domain", {
      type: "secondary",
      issuer: "login.persona.org",
      state: "transition_no_password"
    });
  });

  asyncTest("checkForInvalidCerts with unverified cert and verified address",
      function () {
    testCertCleared("secondary.domain", {
      type: "secondary",
      issuer: "login.persona.org",
      state: "known"
    }, true);
  });

  asyncTest("setComputerOwnershipStatus with true, isUsersComputer - mark the computer as the users, prolongs the user's session", function() {
    lib.authenticate(TEST_EMAIL, "password", function() {
      storage.usersComputer.clear(lib.userid());
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
      storage.usersComputer.clear(lib.userid());
      lib.setComputerOwnershipStatus(false, function() {
        lib.isUsersComputer(function(usersComputer) {
          equal(usersComputer, false, "user is marked as not an owner");
          start();
        }, testHelpers.unexpectedXHRFailure);
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("setComputerOwnershipStatus with unauthenticated user - call onFailure", function() {
    xhr.setContextInfo("auth_status", false);
    xhr.setContextInfo("userid", undefined);
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
      storage.usersComputer.setConfirmed(lib.userid());
      lib.shouldAskIfUsersComputer(function(shouldAsk) {
        equal(shouldAsk, false, "user has been asked already, do not ask again");
        start();
      }, testHelpers.expectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("shouldAskIfUsersComputer with user who has not been asked and has not verified email this dialog session - call onSuccess with true", function() {
    lib.authenticate(TEST_EMAIL, "password", function() {
      storage.usersComputer.forceAsk(lib.userid());
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
        storage.usersComputer.forceAsk(lib.userid());
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

  asyncTest("changePassword success - user's auth_level updated to password", function() {
    xhr.setContextInfo("auth_level", "assertion");
    lib.changePassword("oldpassword", "newpassword", function(changed) {
      equal(changed, true);
      lib.checkAuthentication(function(auth_level) {
        equal(auth_level, "password");
        start();
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

  asyncTest("changePassword with incorrect password - user's auth_level not updated", function() {
    xhr.setContextInfo("auth_level", "assertion");
    xhr.useResult("incorrectPassword");
    lib.changePassword("oldpassword", "newpassword", function(changed) {
      equal(changed, false);
      lib.checkAuthentication(function(auth_level) {
        equal(auth_level, "assertion");
        start();
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });


  test("getIssuer/isDefaultIssuer with default issuer", function() {
    equal(lib.getIssuer(), "default");
    equal(lib.isDefaultIssuer(), true);
  });

  test("setIssuer/getIssuer/isDefaultIssuer with updated issuer", function() {
    var issuer = "fxos.personatest.org";
    lib.setIssuer(issuer);
    equal(lib.getIssuer(), issuer);
    equal(lib.isDefaultIssuer(), false);
  });

  asyncTest("createSecondaryUser with allowUnverified " +
                " should update address cache", function() {
    lib.setAllowUnverified(true);
    // This is an initial call to addressInfo to prime the cache.
    lib.addressInfo(TEST_EMAIL, function(addressInfo) {
      xhr.useResult("unverified");

      lib.createSecondaryUser(TEST_EMAIL, "password", function(status) {
        equal(status.success, true);

        // If creating an unverified account, the user will not go
        // through the verification flow while the dialog is open and the
        // cache will not be updated accordingly. Update the cache now.
        xhr.useResult("valid");
        lib.addressInfo(TEST_EMAIL, function(addressInfo) {
          equal(addressInfo.state, "unverified");
          start();
        }, testHelpers.unexpectedXHRFailure);
      }, testHelpers.unexpectedXHRFailure);
    }, testHelpers.unexpectedXHRFailure);
  });

}());
