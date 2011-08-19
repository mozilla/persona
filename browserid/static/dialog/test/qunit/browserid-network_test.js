/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserIDNetwork: true */
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
steal.plugins("jquery", "funcunit/qunit").then("/dialog/resources/browserid-network", function() {
  module("browserid-network");
  
  test("setOrigin", function() {
    BrowserIDNetwork.setOrigin("https://www.mozilla.com");

    equal("www.mozilla.com", BrowserIDNetwork.origin, "origin's are properly filtered");
  });


  test("authenticate with valid user", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function onSuccess(authenticated) {
      start();
      equal(true, authenticated, "valid authentication");
    }, function onFailure() {
      start();
      ok(false, "valid authentication");
    });

    stop();
  });

  test("authenticate with invalid user", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "invalid", function onSuccess(authenticated) {
      start();
      equal(false, authenticated, "invalid authentication");
    }, function onFailure() {
      start();
      ok(false, "invalid authentication");
    });

    stop();
  });

  test("checkAuth", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function onSuccess(authenticated) {
      BrowserIDNetwork.checkAuth(function onSuccess(authenticated) {
        start();
        equal(true, authenticated, "we have an authentication");
      }, function onFailure() {
        start();
        ok(false, "checkAuth failure");
      });
    }, function onFailure() {
      start();
      ok(false, "valid authentication");
    });

    stop();
  });

  test("logout->checkAuth: are we really logged out?", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function onSuccess(authenticated) {
      BrowserIDNetwork.logout(function onSuccess(authenticated) {
        BrowserIDNetwork.checkAuth(function onSuccess(authenticated) {
          start();
          equal(false, authenticated, "after logout, we are not authenticated");
        }, function onFailure() {
          start();
          ok(false, "checkAuth failure");
        });
      });
    });

    stop();
  });

  test("stageUser", function() {
    ok(true, "stageUser");
  });

  test("haveEmail", function() {
    ok(true, "haveEmail");
  });

  test("removeEmail", function() {
    ok(true, "removeEmail");
  });

  test("checkRegistration", function() {
    ok(true, "checkRegistration");
  });

  test("setKey", function() {
    ok(true, "setKey");
  });

  test("syncEmails", function() {
    ok(true, "syncEmails");
  });
});
