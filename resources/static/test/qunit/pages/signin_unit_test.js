/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
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
(function() {
  "use strict";

  var bid = BrowserID,
      network = bid.Network,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      CHECK_DELAY = 500,
      docMock = {
        location: "signin"
      }

  module("pages/signin", {
    setup: function() {
      network.setXHR(xhr);
      $(".error").removeClass("error");
      $("#error").stop().hide();
      xhr.useResult("valid");
      docMock.location = "signin";
      bid.signIn({document: docMock});
    },
    teardown: function() {
      network.setXHR($);
      $(".error").removeClass("error");
      $("#error").stop().hide();
      $("#error .message").remove();
      bid.signIn.reset();
    }
  });

  function testUserNotSignedIn(extraTests) {
    bid.signIn.submit();

    setTimeout(function() {
      equal(docMock.location, "signin", "user not signed in");
      if (extraTests) extraTests();
      else start();
    }, 100);
  }

  asyncTest("signin with valid email and password", function() {
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    bid.signIn.submit();

    setTimeout(function() {
      equal(docMock.location, "/", "user signed in, page redirected");
      start();
    }, 100);
  });

  asyncTest("signin with valid email with leading/trailing whitespace and password", function() {
    $("#email").val("  registered@testuser.com  ");
    $("#password").val("password");

    bid.signIn.submit();

    setTimeout(function() {
      equal(docMock.location, "/", "user signed in, page redirected");
      start();
    }, 100);
  });

  asyncTest("signin with missing email", function() {
    $("#email").val("");
    $("#password").val("password");

    testUserNotSignedIn();
  });

  asyncTest("signin with missing password", function() {
    $("#email").val("registered@testuser.com");
    $("#password").val("");

    testUserNotSignedIn();
  });


  asyncTest("signin with bad username/password", function() {
    xhr.useResult("invalid");
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    testUserNotSignedIn();
  });

  asyncTest("signin with XHR error", function() {
    xhr.useResult("ajaxError");
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    testUserNotSignedIn(function() {
      setTimeout(function() {
        equal($("#error").is(":visible"), true, "error is visible");
        start();
      }, 500);
    });
  });


}());
