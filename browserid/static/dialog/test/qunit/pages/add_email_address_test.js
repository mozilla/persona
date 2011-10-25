/*jshint browsers:true, forin: true, laxbreak: true */
/*global steal: true, test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
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
steal.plugins("jquery").then("/js/pages/add_email_address", function() {
  "use strict";

  var bid = BrowserID,
      network = bid.Network,
      storage = bid.Storage,
      emailForVerificationTokenFailure = false,
      completeEmailRegistrationFailure = false,
      validToken = true;
  
  var netMock = {
    emailForVerificationToken: function(token, onSuccess, onFailure) {
      emailForVerificationTokenFailure ? onFailure() : onSuccess("testuser@testuser.com");
    },

    completeEmailRegistration: function(token, onSuccess, onFailure) {
      completeEmailRegistrationFailure ? onFailure() : onSuccess(validToken);
    }
  };

  module("pages/add_email_address", {
    setup: function() {
      BrowserID.User.setNetwork(netMock);  
      emailForVerificationTokenFailure = completeEmailRegistrationFailure = false;
      validToken = true;
      $(".error").stop().hide();
      $(".website").text("");
    },
    teardown: function() {
      BrowserID.User.setNetwork(network);  
      $(".error").stop().hide();
      $(".website").text("");
    }
  });

  test("addEmailAddress with good token and site", function() {
    storage.setStagedOnBehalfOf("browserid.org");

    bid.addEmailAddress("token");
    
    equal($("#email").text(), "testuser@testuser.com", "email set");
    ok($("#siteinfo").is(":visible"), "siteinfo is visible when we say what it is");
    equal($("#siteinfo .website").text(), "browserid.org", "origin is updated");
  });

  test("addEmailAddress with good token and nosite", function() {
    bid.addEmailAddress("token");
    
    equal($("#email").text(), "testuser@testuser.com", "email set");
    equal($("#siteinfo").is(":visible"), false, "siteinfo is not visible without having it");
    equal($("#siteinfo .website").text(), "", "origin is not updated");
  });

  test("addEmailAddress with bad token", function() {
    validToken = false;

    bid.addEmailAddress("token");
    ok($("#cannotconfirm").is(":visible"), "cannot confirm box is visible");
  });

  test("addEmailAddress with emailForVerficationToken XHR failure", function() {
    validToken = true;
    emailForVerificationTokenFailure = true;
    bid.addEmailAddress("token");

    ok($("#cannotcommunicate").is(":visible"), "cannot communicate box is visible");
  });

  test("addEmailAddress with completeEmailRegistration XHR failure", function() {
    validToken = true;
    completeEmailRegistrationFailure = true;
    bid.addEmailAddress("token");

    ok($("#cannotcommunicate").is(":visible"), "cannot communicate box is visible");
  });
});
