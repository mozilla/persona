/*jshint browsers:true, forin: true, laxbreak: true */
/*global steal: true, test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID: true */
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
steal.then(function() {
  "use strict";

  var bid = BrowserID,
      helpers = bid.Helpers;

  module("shared/helpers", {
    setup: function() {

    },

    teardown: function() {
    }
  });

  test("extend", function() {
    var target = {};
    helpers.extend(target, {
      field1: true,
      field2: "value"
    });

    equal(target.field1, true, "target extended");
    equal(target.field2, "value", "target extended");
  });

  test("getAndValidateEmail with valid email", function() {
    $("#email").val("testuser@testuser.com");
    var email = helpers.getAndValidateEmail("#email");

    equal(email, "testuser@testuser.com", "valid email returns email");
  });

  test("getAndValidateEmail with valid email with leading and trailing whitespace", function() {
    $("#email").val(" testuser@testuser.com ");
    var email = helpers.getAndValidateEmail("#email");

    equal(email, "testuser@testuser.com", "valid email with leading/trailing whitespace returns trimmed email");
  });

  test("getAndValidateEmail with invalid email returns null", function() {
    $("#email").val("testuser");
    var email = helpers.getAndValidateEmail("#email");

    strictEqual(email, null, "invalid email returns null");
  });

  test("getAndValidateEmail with invalid target returns null", function() {
    var email = helpers.getAndValidateEmail("#nonexistent");

    strictEqual(email, null, "invalid target returns null");
  });

  test("getAndValidatePassword with valid password returns password", function() {
    $("#password").val("password");
    var password = helpers.getAndValidatePassword("#password");

    equal(password, "password", "password retreived correctly");
  });

  test("getAndValidatePassword with invalid password returns null", function() {
    $("#password").val("");
    var password = helpers.getAndValidatePassword("#password");

    strictEqual(password, null, "invalid password returns null");
  });

  test("getAndValidatePassword with invalid target returns null", function() {
    var password = helpers.getAndValidatePassword("#nonexistent");

    strictEqual(password, null, "invalid target returns null");
  });
});
