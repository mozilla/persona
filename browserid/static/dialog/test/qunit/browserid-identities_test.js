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
  module("browserid-identities");

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

  test("addIdentity", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function() {
      BrowserIDIdentities.addIdentity("testemail@testemail.com", "issuer", function(keypair) {
        equal("object", typeof keypair, "we have a keypair");

        var identities = BrowserIDIdentities.getStoredIdentities();
        ok("testemail@testemail.com" in identities, "Our new email is added");

        start();
      }, failure("addIdentity failure"));
    }, failure("Authentication failure"));

    stop();
  });

  test("persistIdentity", function() {
    BrowserIDIdentities.persistIdentity("testemail2@testemail.com", { pub: "pub", priv: "priv" });
    var identities = BrowserIDIdentities.getStoredIdentities();
    ok("testemail2@testemail.com" in identities, "Our new email is added");
  });

  test("removeIdentity that we add", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function() {
      BrowserIDIdentities.addIdentity("testemail@testemail.com", "issuer", function(keypair) {
        BrowserIDIdentities.removeIdentity("testemail@testemail.com", function() {
          var identities = BrowserIDIdentities.getStoredIdentities();
          equal(false, "testemail@testemail.com" in identities, "Our new email is removed");
          start();
        }, failure("removeIdentity failure"));
      }, failure("addIdentity failure"));
    }, failure("Authentication failure"));

    stop();
  });
  
  test("syncIdentities with no identities", function() {
    clearEmails();
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function() {
      BrowserIDIdentities.syncIdentities(function onSuccess() {
        ok(true, "we have synced identities");
        start();
      }, failure("identity sync failure"));
    }, failure("Authentication failure"));

    stop();
  });

  test("syncIdentities with identities preloaded", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function() {
      BrowserIDIdentities.syncIdentities(function onSuccess() {
        ok(true, "we have synced identities");
        start();
      }, failure("identity sync failure"));
    }, failure("Authentication failure"));

    stop();
  });

});
