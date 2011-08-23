/*jshint browsers:true, forin: true, laxbreak: true */
/*global steal: true, test: true, start: true, stop: true, module: true, ok: true, equal: true, clearEmails: true, BrowserIDNetwork: true , BrowserIDIdentities: true */
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
/**
 * This test assumes for authentication that there is a user named 
 * "testuser@testuser.com" with the password "testuser"
 */
steal.plugins("jquery", "funcunit/qunit").then("/dialog/resources/browserid-identities", function() {
  var credentialsValid, unknownEmails, keyRefresh;
  var netStub = {
    reset: function() {
      credentialsValid = true;
      unknownEmails = [];
      keyRefresh = [];
    },
    stageUser: function(email, password, keypair, onSuccess) {
      onSuccess();
    },

    authenticate: function(email, password, onSuccess, onFailure) {
      onSuccess(credentialsValid);
    },

    syncEmails: function(issued_identities, onSuccess, onFailure) {
      onSuccess({
        unknown_emails: unknownEmails,
        key_refresh: keyRefresh
      });
    },

    setKey: function(email, keypair, onSuccess, onError) {
      if (onSuccess) {
        onSuccess();
      }
    }
  };

  module("browserid-identities-unit", {

    setup: function() {
      BrowserIDIdentities.setNetwork(netStub);
      netStub.reset();
    },
    teardown: function() {
      BrowserIDIdentities.setNetwork(BrowserIDNetwork);
    }
  });

  function failure(message) {
    return function() {
      ok(false, message);
      start();
    };
  }

  test("getStoredIdentities", function() {
    var identities = BrowserIDIdentities.getStoredIdentities();
    equal("object", typeof identities, "we have some identities");
  });

  test("clearStoredIdentities", function() {
    BrowserIDIdentities.clearStoredIdentities();
    var identities = BrowserIDIdentities.getStoredIdentities();
    var count = 0;
    for(var key in identities) { 
      if(identities.hasOwnProperty(key)) {
        count++; 
      }
    }

    equal(0, count, "after clearing, there are no identities");
  });

  test("stageIdentity", function() {
    BrowserIDIdentities.stageIdentity("testuser@testuser.com", "testuser", function(keypair) {
      equal("object", typeof keypair, "We have a key pair");
      start();
    }, failure("stageIdentity failure"));

    stop();
  });

  test("confirmIdentity", function() {
  /*  BrowserIDIdentities.confirmIdentity("testuser@testuser.com", function() {
      start();
    });

    stop();
    */
  });

  test("authenticateAndSync with valid credentials", function() {
    BrowserIDIdentities.authenticateAndSync("testuser@testuser.com", "testuser", function() {
    }, function(authenticated) {
      equal(true, authenticated, "we are authenticated!");
      start();
    }, failure("Authentication failure"));

    stop();

  });

  test("authenticateAndSync with invalid credentials", function() {
    credentialsValid = false;
    BrowserIDIdentities.authenticateAndSync("testuser@testuser.com", "testuser", function onSuccess(authenticated) {
      ok(false, "This should not be called on authentication failure");
    }, function onComplete(authenticated) {
      equal(false, authenticated, "invalid authentication.");
      start();
    }, failure("Authentication failure"));

    stop();

  });
/*
  test("checkAuthenticationAndSync", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function() {
      clearEmails();
      BrowserIDIdentities.checkAuthenticationAndSync(function() {
        var identities = BrowserIDIdentities.getStoredIdentities();
        ok("testuser@testuser.com" in identities, "checkAuthenticationAndSync syncs email addresses");
        start();
      });
    }, failure("Authentication failure"));

    stop();
  });

  test("addIdentity", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function() {
      BrowserIDIdentities.removeIdentity("testemail@testemail.com", function() {
        BrowserIDIdentities.addIdentity("testemail@testemail.com", function(keypair) {
          equal("object", typeof keypair, "we have a keypair");

          var identities = BrowserIDIdentities.getStoredIdentities();
          equal(false, "testemail@testemail.com" in identities, "Our new email is not added until confirmation.");

          start();
        }, failure("addIdentity failure"));
      }, failure("removeIdentity failure"));
    }, failure("Authentication failure"));

    stop();
  });

  /*
  test("syncIdentity on confirmed email address", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function() {
      BrowserIDIdentities.removeIdentity("testemail@testemail.com", "issuer", function() {
        // XXX verify the identity here 
        BrowserIDIdentities.syncIdentity("testemail@testemail.com", "issuer", function(keypair) {
          ok(false, "Syncing a non-verified identity should fail");

          start();
        }, failure("syncIdentity failure"));
      }, failure("removeIdentity failure"));
    }, failure("Authentication failure"));

    stop();
  });
*/

  test("persistIdentity", function() {
    BrowserIDIdentities.persistIdentity("testemail2@testemail.com", { pub: "pub", priv: "priv" }, undefined, function onSuccess() {
      var identities = BrowserIDIdentities.getStoredIdentities();
      ok("testemail2@testemail.com" in identities, "Our new email is added");
      start(); 
    });

    stop();
  });

  /*
  test("removeIdentity that we add", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function() {
      BrowserIDIdentities.syncIdentity("testemail@testemail.com", "issuer", function(keypair) {
        BrowserIDIdentities.removeIdentity("testemail@testemail.com", function() {
          var identities = BrowserIDIdentities.getStoredIdentities();
          equal(false, "testemail@testemail.com" in identities, "Our new email is removed");
          start();
        }, failure("removeIdentity failure"));
      }, failure("syncIdentity failure"));
    }, failure("Authentication failure"));

    stop();
  });
  */
  test("syncIdentities with no pre-loaded identities and no identities to add", function() {
    clearEmails();
    BrowserIDIdentities.syncIdentities(function onSuccess() {
      var identities = BrowserIDIdentities.getStoredIdentities();
      ok(true, "we have synced identities");
      equal(_.size(identities), 0, "there are no identities");
      start();
    }, failure("identity sync failure"));

    stop();
  });

  test("syncIdentities with no pre-loaded identities and identities to add", function() {
    clearEmails();
    keyRefresh = ["testuser@testuser.com"];
    BrowserIDIdentities.syncIdentities(function onSuccess() {
      var identities = BrowserIDIdentities.getStoredIdentities();
      ok("testuser@testuser.com" in identities, "Our new email is added");
      equal(_.size(identities), 1, "there is one identity");
      start(); 
    }, failure("identity sync failure"));

    stop();
  });

  test("syncIdentities with identities preloaded and none to add", function() {
    clearEmails();
    addEmail("testuser@testuser.com", {});

    BrowserIDIdentities.syncIdentities(function onSuccess() {
      var identities = BrowserIDIdentities.getStoredIdentities();
      ok("testuser@testuser.com" in identities, "Our new email is added");
      equal(_.size(identities), 1, "there is one identity");
      start();
    }, failure("identity sync failure"));

    stop();
  });


  test("syncIdentities with identities preloaded and one to add", function() {
    clearEmails();
    addEmail("testuser@testuser.com", {});
    keyRefresh = ["testuser2@testuser.com"];

    BrowserIDIdentities.syncIdentities(function onSuccess() {
      var identities = BrowserIDIdentities.getStoredIdentities();
      ok("testuser@testuser.com" in identities, "Our old email address is still there");
      ok("testuser2@testuser.com" in identities, "Our new email is added");
      equal(_.size(identities), 2, "there are two identities");
      start();
    }, failure("identity sync failure"));

    stop();
  });


  test("syncIdentities with identities preloaded and one to remove", function() {
    clearEmails();
    addEmail("testuser@testuser.com", {});
    addEmail("testuser2@testuser.com", {});
    unknownEmails = ["testuser2@testuser.com"];

    BrowserIDIdentities.syncIdentities(function onSuccess() {
      var identities = BrowserIDIdentities.getStoredIdentities();
      ok("testuser@testuser.com" in identities, "Our old email address is still there");
      equal("testuser2@testuser.com" in identities, false, "Our unknown email is removed");
      equal(_.size(identities), 1, "there is one identity");
      start();
    }, failure("identity sync failure"));

    stop();
  });


  test("getIdentityAssertion with known email", function() {
    clearEmails();
    var keypair = CryptoStubs.genKeyPair();
    addEmail("testuser@testuser.com", { priv: keypair.priv, issuer: "issuer" });

    BrowserIDIdentities.getIdentityAssertion("testuser@testuser.com", function onSuccess(assertion) {
      equal("string", typeof assertion, "we have an assertion!");
      start();
    });

    stop();
  });


  test("getIdentityAssertion with unknown email", function() {
    clearEmails();
    var keypair = CryptoStubs.genKeyPair();
    addEmail("testuser@testuser.com", { priv: keypair.priv, issuer: "issuer" });

    BrowserIDIdentities.getIdentityAssertion("testuser2@testuser.com", function onSuccess(assertion) {
      equal("undefined", typeof assertion, "email was unknown, we do not have an assertion");
      start();
    });

    stop();
  });
  /*
  test("syncIdentity on non-confirmed email address", function() {
    clearEmails();
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function() {
      BrowserIDIdentities.removeIdentity("testemail@testemail.com", function() {
        BrowserIDIdentities.syncIdentity("testemail@testemail.com", "issuer", function(keypair) {
          ok(false, "Syncing a non-verified identity should fail");

          start();
        }, function() {
          ok(true, "trying to sync an identity that is not yet verified should fail");

          var identities = BrowserIDIdentities.getStoredIdentities();
          equal("testemail@testemail.com" in identities, false, "Our new email is added");

          start();
        });
      }, failure("removeIdentity failure"));
    }, failure("Authentication failure"));

    stop();
  });

  test("syncIdentity without first validating email", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function() {
      // First, force removal that way we know it is not part of our list.
      BrowserIDIdentities.removeIdentity("unvalidated@unvalidated.com", function() {

        clearEmails();
        BrowserIDIdentities.syncIdentities(function onSuccess() {

          var identities = BrowserIDIdentities.getStoredIdentities();
          // Make sure the server has forgotten about this email address.
          equal("unvalidated@unvalidated.com" in identities, false, "The removed email should not be on the list.");

          // This next call will call /wsapi/set_key on a 
          // key that has not been validated.
          BrowserIDIdentities.syncIdentity("unvalidated@unvalidated.com", "issuer", function(keypair) {
            // Clear all the local emails, then refetch the list from the server
            // just to be sure we are seeing what the server sees.
            clearEmails();
            BrowserIDIdentities.syncIdentities(function onSuccess() {

              var identities = BrowserIDIdentities.getStoredIdentities();
              // woah.  Things just went wrong.
              equal("unvalidated@unvalidated.com" in identities, false, "The unvalidated email should not be added just through calling sync_key");
              start();
            }, failure("syncIdentities failure"));
          }, function() {
            ok(true, "We expect syncIdentity to fail on an address we cannot confirm");
          });
        }, failure("syncIdentities failure"));
      }, failure("removeEmail failure"));
    }, failure("Authentication failure"));

    stop();
  });
*/
});
