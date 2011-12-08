/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID: true */
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
      validation = bid.Validation,
      tooltipShown,
      origShowTooltip;

  function showTooltip(el) {
    tooltipShown = true;
  }

  module("shared/validation", {
    setup: function() {
      origShowTooltip = bid.Tooltip.showTooltip;
      bid.Tooltip.showTooltip = showTooltip;
      tooltipShown = false;
    },

    teardown: function() {
      bid.Tooltip.showTooltip = origShowTooltip;
    }
  });

  test("email address x@y.z is valid", function() {
    ok(bid.verifyEmail("x@y.z"), "x@y.z is valid");
  });

  test("email address x@y.z.w is valid", function() {
    ok(bid.verifyEmail("x@y.z.w"), "x@y.z.w is valid");
  });

  test("email address x.v@y.z.w is valid", function() {
    ok(bid.verifyEmail("x.v@y.z.w"), "x.v@y.z.w is valid");
  });

  test("email address x_v@y.z.w is valid", function() {
    ok(bid.verifyEmail("x_v@y.z.w"), "x_v@y.z.w is valid");
  });

  test("email address x is not valid", function() {
    equal(bid.verifyEmail("x"), false, "x is not valid");
  });

  test("email address x@y is not valid", function() {
    equal(bid.verifyEmail("x@y"), false, "x@y is not valid");
  });

  test("email address x@y. is not valid", function() {
    equal(bid.verifyEmail("x@y."), false, "x@y. is not valid");
  });



  test("email with valid email", function() {
    var valid = validation.email("testuser@testuser.com");

    ok(valid, "valid email is valid");
    equal(tooltipShown, false, "valid email shows no tooltip");
  });

  test("email with empty email", function() {
    var valid = validation.email("");

    equal(valid, false, "missing email is missing");
    equal(tooltipShown, true, "missing email shows no tooltip");
  });

  test("email with Capital Letters in local side", function() {
    var valid = validation.email("X@y.z");

    equal(valid, true, "capital letters allowed in local side");
    equal(tooltipShown, false, "capital letters in local side causes no tooltip");
  });

  test("email with Capital Letters in domain side", function() {
    var valid = validation.email("x@Y.z");

    equal(valid, true, "capital letters are allowed in domain side");
    equal(tooltipShown, false, "capital letters in domain side causes no tooltip");
  });

  test("email with numbers in domain side", function() {
    var valid = validation.email("x@0.Z");

    equal(valid, true, "numbers are allowed in domain side");
    equal(tooltipShown, false, "numbers in domain side causes no tooltip");
  });


  test("email with 64 characters in local side", function() {
    var local = "";

    for(var i = 0; i < 64; i++) {
      local += "a";
    }

    var valid = validation.email(local + "@y.z");

    equal(valid, true, "64 characters allowed in local side");
    equal(tooltipShown, false, "64 characters causes no error");
  });

  test("email with more than 64 characters in local side", function() {
    var local = "";

    for(var i = 0; i <= 64; i++) {
      local += "a";
    }

    var valid = validation.email(local + "@y.z");

    equal(valid, false, "only 64 characters allowed in local side");
    equal(tooltipShown, true, "65 characters causes an error");
  });

  test("email with 254 characters", function() {
    var domain = "";

    for(var i = 0; i < 248; i++) {
      domain += "a";
    }

    var valid = validation.email("x@" + domain * ".com");

    equal(valid, false, "254 characters allowed in total address");
    equal(tooltipShown, true, "254 characters causes no error");
  });

  test("email with more than 254 characters", function() {
    var domain = "";

    for(var i = 0; i <= 248; i++) {
      domain += "a";
    }

    var valid = validation.email("x@" + domain * ".com");

    equal(valid, false, "only 254 characters allowed in total address");
    equal(tooltipShown, true, "> 254 characters causes an error");
  });

  test("email with invalid email", function() {
    var valid = validation.email("testuser@testuser");

    equal(valid, valid, "invalid email is invalid");
    equal(tooltipShown, true, "invalid email shows no tooltip");
  });


  test("password with valid password", function() {
    var valid = validation.password("password");

    ok(valid, "valid password is valid");
    equal(tooltipShown, false, "valid password shows no tooltip");
  });

  test("password with missing password", function() {
    var valid = validation.password("");

    equal(valid, false, "invalid password is invalid");
    equal(tooltipShown, true, "invalid password shows tooltip");
  });

  test("validateEmailAndPassword with valid email and password", function() {
    var valid = validation.emailAndPassword("testuser@testuser.com", "password");

    ok(valid, "valid email and password are valid");
    equal(tooltipShown, false, "valid email and password shows no tooltip");
  });

  test("validateEmailAndPassword with empty email", function() {
    var valid = validation.emailAndPassword("", "password");

    equal(valid, false, "empty email is invalid");
    equal(tooltipShown, true, "empty email shows tooltip");
  });

  test("validateEmailAndPassword with invalid email", function() {
    var valid = validation.emailAndPassword("testuser", "password");

    equal(valid, false, "invalid email is invalid");
    equal(tooltipShown, true, "invalid email shows tooltip");
  });

  test("validateEmailAndPassword with empty password", function() {
    var valid = validation.emailAndPassword("testuser@testuser.com", "");

    equal(valid, false, "empty password is invalid");
    equal(tooltipShown, true, "empty password shows tooltip");
  });


  test("passwordAndValidationPassword with empty password", function() {
    var valid = validation.passwordAndValidationPassword("", "password");

    equal(valid, false, "empty password is invalid");
    equal(tooltipShown, true, "empty password shows tooltip");
  });


  test("passwordAndValidationPassword with too short password", function() {
    var valid = validation.passwordAndValidationPassword("pass", "password");

    equal(valid, false, "too short password is invalid");
    equal(tooltipShown, true, "too short password shows tooltip");
  });

  test("passwordAndValidationPassword with empty validation password", function() {
    var valid = validation.passwordAndValidationPassword("password", "");

    equal(valid, false, "empty validation password is invalid");
    equal(tooltipShown, true, "empty validation password shows tooltip");
  });


  test("passwordAndValidationPassword with different validation password", function() {
    var valid = validation.passwordAndValidationPassword("password", "pass");

    equal(valid, false, "different password is invalid");
    equal(tooltipShown, true, "different password shows tooltip");
  });

  test("passwordAndValidationPassword all valid", function() {
    var valid = validation.passwordAndValidationPassword("password", "password");

    equal(valid, true, "passwords valid");
    equal(tooltipShown, false, "tooltip not shown");
  });

}());


