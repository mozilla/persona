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

(function() {
  var bid = BrowserID,
      lib = bid.User,
      storage = bid.Storage,
      network = bid.Network,
      xhr = bid.Mocks.xhr,
      testOrigin = "testOrigin";

  // I generated these locally, they are used nowhere else.
  var pubkey = {"algorithm":"RS","n":"56063028070432982322087418176876748072035482898334811368408525596198252519267108132604198004792849077868951906170812540713982954653810539949384712773390200791949565903439521424909576832418890819204354729217207360105906039023299561374098942789996780102073071760852841068989860403431737480182725853899733706069","e":"65537"};

  // this cert is meaningless, but it has the right format
  var random_cert = "eyJhbGciOiJSUzEyOCJ9.eyJpc3MiOiJpc3N1ZXIuY29tIiwiZXhwIjoxMzE2Njk1MzY3NzA3LCJwdWJsaWMta2V5Ijp7ImFsZ29yaXRobSI6IlJTIiwibiI6IjU2MDYzMDI4MDcwNDMyOTgyMzIyMDg3NDE4MTc2ODc2NzQ4MDcyMDM1NDgyODk4MzM0ODExMzY4NDA4NTI1NTk2MTk4MjUyNTE5MjY3MTA4MTMyNjA0MTk4MDA0NzkyODQ5MDc3ODY4OTUxOTA2MTcwODEyNTQwNzEzOTgyOTU0NjUzODEwNTM5OTQ5Mzg0NzEyNzczMzkwMjAwNzkxOTQ5NTY1OTAzNDM5NTIxNDI0OTA5NTc2ODMyNDE4ODkwODE5MjA0MzU0NzI5MjE3MjA3MzYwMTA1OTA2MDM5MDIzMjk5NTYxMzc0MDk4OTQyNzg5OTk2NzgwMTAyMDczMDcxNzYwODUyODQxMDY4OTg5ODYwNDAzNDMxNzM3NDgwMTgyNzI1ODUzODk5NzMzNzA2MDY5IiwiZSI6IjY1NTM3In0sInByaW5jaXBhbCI6eyJlbWFpbCI6InRlc3R1c2VyQHRlc3R1c2VyLmNvbSJ9fQ.aVIO470S_DkcaddQgFUXciGwq2F_MTdYOJtVnEYShni7I6mqBwK3fkdWShPEgLFWUSlVUtcy61FkDnq2G-6ikSx1fUZY7iBeSCOKYlh6Kj9v43JX-uhctRSB2pI17g09EUtvmb845EHUJuoowdBLmLa4DSTdZE-h4xUQ9MsY7Ik";


  function testAssertion(assertion, cb) {
    equal(typeof assertion, "string", "An assertion was correctly generated");

    // Decode the assertion to a bundle.
    var bundle = JSON.parse(window.atob(assertion));

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
      network.setXHR(xhr);
      xhr.useResult("valid");
      lib.clearStoredEmailKeypairs();
      lib.setOrigin(testOrigin);
    },
    teardown: function() {
      network.setXHR($);
    }
  });

  function failure(message) {
    return function() {
      ok(false, message);
      start();
    };
  }

  test("setOrigin, getOrigin", function() {
    lib.setOrigin(testOrigin);
    equal(lib.getOrigin(), testOrigin);
  });

  test("setOrigin, getHostname", function() {
    var origin = "http://testorigin.com:10001";
    lib.setOrigin(origin);

    var hostname = lib.getHostname();
    equal(hostname, "testorigin.com", "getHostname returns only the hostname");
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
    }, failure("syncEmailKeypair failure"));
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

  asyncTest("createUser", function() {
    lib.createUser("testuser@testuser.com", function(status) {
      ok(status, "user created");
      start();
    }, failure("createUser failure"));
  });

  asyncTest("createUser with user creation refused", function() {
    xhr.useResult("throttle");

    lib.createUser("testuser@testuser.com", function(status) {
      equal(status, false, "user creation refused");
      start();
    }, failure("createUser failure"));
  });

  asyncTest("createUser with XHR failure", function() {
    xhr.useResult("ajaxError");

    lib.createUser("testuser@testuser.com", function(status) {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });

  asyncTest("waitForUserValidation with `complete` response", function() {
    storage.setStagedOnBehalfOf(testOrigin);

    xhr.useResult("complete");

    lib.waitForUserValidation("registered@testuser.com", function(status) {
      equal(status, "complete", "complete response expected");

      ok(!storage.getStagedOnBehalfOf(), "staged on behalf of is cleared when validation completes");
      start();
    }, failure("waitForUserValidation failure"));
  });

  asyncTest("waitForUserValidation with `mustAuth` response", function() {
    storage.setStagedOnBehalfOf(testOrigin);

    xhr.useResult("mustAuth");

    lib.waitForUserValidation("registered@testuser.com", function(status) {
      equal(status, "mustAuth", "mustAuth response expected");

      ok(!storage.getStagedOnBehalfOf(), "staged on behalf of is cleared when validation completes");
      start();
    }, failure("waitForUserValidation failure"));
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

  asyncTest("verifyUser with a good token", function() {
    storage.setStagedOnBehalfOf(testOrigin);

    lib.verifyUser("token", "password", function onSuccess(info) {

      ok(info.valid, "token was valid");
      equal(info.email, "testuser@testuser.com", "email part of info");
      equal(info.origin, testOrigin, "origin in info");
      equal(storage.getStagedOnBehalfOf(), "", "initiating origin was removed");

      start();
    }, failure("verifyUser failure"));
  });

  asyncTest("verifyUser with a bad token", function() {
    xhr.useResult("invalid");

    lib.verifyUser("token", "password", function onSuccess(info) {

      equal(info.valid, false, "bad token calls onSuccess with a false validity");

      start();
    }, failure("verifyUser failure"));
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
    }, failure("Authentication failure"));
  });


  asyncTest("authenticate with invalid credentials", function() {
    xhr.useResult("invalid");
    lib.authenticate("testuser@testuser.com", "testuser", function onComplete(authenticated) {
      equal(false, authenticated, "invalid authentication.");
      start();
    }, failure("Authentication failure"));
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
    }, failure("addEmail failure"));
  });

  asyncTest("addEmail with addition refused", function() {
    xhr.useResult("throttle");

    lib.addEmail("testemail@testemail.com", function(added) {
      equal(added, false, "user addition was refused");

      var identities = lib.getStoredEmailKeypairs();
      equal(false, "testemail@testemail.com" in identities, "Our new email is not added until confirmation.");

      equal(typeof storage.getStagedOnBehalfOf(), "undefined", "initiatingOrigin is not stored");

      start();
    }, failure("addEmail failure"));
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
    }, failure("waitForEmailValidation failure"));
  });

  asyncTest("waitForEmailValidation `mustAuth` response", function() {
    storage.setStagedOnBehalfOf(testOrigin);
    xhr.useResult("mustAuth");

    lib.waitForEmailValidation("registered@testuser.com", function(status) {
      ok(!storage.getStagedOnBehalfOf(), "staged on behalf of is cleared when validation completes");
      equal(status, "mustAuth", "mustAuth response expected");
      start();
    }, failure("waitForEmailValidation failure"));
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

  asyncTest("verifyEmail with a good token", function() {
    storage.setStagedOnBehalfOf(testOrigin);
    lib.verifyEmail("token", function onSuccess(info) {

      ok(info.valid, "token was valid");
      equal(info.email, "testuser@testuser.com", "email part of info");
      equal(info.origin, testOrigin, "origin in info");
      equal(storage.getStagedOnBehalfOf(), "", "initiating origin was removed");

      start();
    }, failure("verifyEmail failure"));
  });

  asyncTest("verifyEmail with a bad token", function() {
    xhr.useResult("invalid");

    lib.verifyEmail("token", function onSuccess(info) {

      equal(info.valid, false, "bad token calls onSuccess with a false validity");

      start();
    }, failure("verifyEmail failure"));
  });

  asyncTest("verifyEmail with an XHR failure", function() {
    xhr.useResult("ajaxError");

    lib.verifyEmail("token", function onSuccess(info) {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
  });

  asyncTest("syncEmailKeypair with successful sync", function() {
    lib.syncEmailKeypair("testemail@testemail.com", function(keypair) {
      var identity = lib.getStoredEmailKeypair("testemail@testemail.com");

      ok(identity, "we have an identity");
      ok(identity.priv, "a private key is on the identity");
      ok(identity.pub, "a private key is on the identity");

      start();
    }, failure("syncEmailKeypair failure"));
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
    }, failure("removeEmail failure"));
  });



  asyncTest("removeEmail that is not added", function() {
    lib.removeEmail("testemail@testemail.com", function() {
      var identities = lib.getStoredEmailKeypairs();
      equal(false, "testemail@testemail.com" in identities, "Our new email is removed");
      start();
    }, failure("removeEmail failure"));
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
    }, failure("identity sync failure"));
  });

  asyncTest("syncEmails with no pre-loaded identities and identities to add", function() {
    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok("testuser@testuser.com" in identities, "Our new email is added");
      equal(_.size(identities), 1, "there is one identity");
      start();
    }, failure("identity sync failure"));
  });

  asyncTest("syncEmails with identities preloaded and none to add", function() {
    storage.addEmail("testuser@testuser.com", {});
    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok("testuser@testuser.com" in identities, "Our new email is added");
      equal(_.size(identities), 1, "there is one identity");
      start();
    }, failure("identity sync failure"));
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
    }, failure("identity sync failure"));
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
    }, failure("identity sync failure"));
  });

  asyncTest("syncEmails with one to refresh", function() {
    storage.addEmail("testuser@testuser.com", {pub: pubkey, cert: random_cert});

    lib.syncEmails(function onSuccess() {
      var identities = lib.getStoredEmailKeypairs();
      ok("testuser@testuser.com" in identities, "refreshed key is synced");
      start();
    }, failure("identity sync failure"));
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
    lib.setOrigin(testOrigin);
    lib.removeEmail("testuser@testuser.com");
    lib.syncEmailKeypair("testuser@testuser.com", function() {
      lib.getAssertion("testuser@testuser.com", function onSuccess(assertion) {
        testAssertion(assertion, start);
      }, failure("getAssertion failure"));
    }, failure("syncEmailKeypair failure"));
  });


  asyncTest("getAssertion with known email that does not have a key", function() {
    lib.setOrigin(testOrigin);
    lib.removeEmail("testuser@testuser.com");
    storage.addEmail("testuser@testuser.com", {});
    lib.getAssertion("testuser@testuser.com", function onSuccess(assertion) {
      testAssertion(assertion, start);
    }, failure("getAssertion failure"));
  });


  asyncTest("getAssertion with unknown email", function() {
    lib.syncEmailKeypair("testuser@testuser.com", function() {
      lib.getAssertion("testuser2@testuser.com", function onSuccess(assertion) {
        equal("undefined", typeof assertion, "email was unknown, we do not have an assertion");
        start();
      });
    }, failure("getAssertion failure"));
  });

  asyncTest("getAssertion with XHR failure", function() {
    lib.setOrigin(testOrigin);
    xhr.useResult("ajaxError");

    lib.syncEmailKeypair("testuser@testuser.com", function() {
      ok(false, "xhr failure should never succeed");
      start();
    }, function() {
      ok(true, "xhr failure should always be a failure");
      start();
    });
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
        }, failure("logoutUser failure"));
      }, failure("syncEmails failure"));
    }, failure("authenticate failure"));


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


      }, failure("syncEmails failure"));
    }, failure("authenticate failure"));


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

  asyncTest("getPersistentSigninAssertion with invalid login", function() {
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

  asyncTest("getPersistentSigninAssertion with valid login with remember set to true but no email", function() {
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

  asyncTest("getPersistentSigninAssertion with valid login with email and remember set to false", function() {
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

  asyncTest("getPersistentSigninAssertion with valid login, email, and remember set to true", function() {
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
