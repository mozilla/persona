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
steal.then(function() {
  "use strict";

  var controller,
      el = $("body"),
      bid = BrowserID,
      storage = bid.Storage,
      network = bid.Network,
      xhr = bid.Mocks.xhr,
      hub = OpenAjax.hub,
      registrations = [];

  function register(message, cb) {
    registrations.push(hub.subscribe(message, cb));
  }

  function unregisterAll() {
    var registration;
    while(registration = registrations.pop()) {
      hub.unsubscribe(registration);
    }
  }

  function reset() {
    el = $("#controller_head");
    el.find("#formWrap .contents").html("");
    el.find("#wait .contents").html("");
    el.find("#error .contents").html("");
  }

  module("controllers/forgotpassword_controller", {
    setup: function() {
      $("#email").val("");
      reset();
      storage.clear();
      network.setXHR(xhr);
      xhr.useResult("valid");
      controller = el.forgotpassword({ email: "registered@testuser.com" }).controller();
    },

    teardown: function() {
      if (controller) {
        try {
          controller.destroy();
          controller = null;
        } catch(e) {
          // may already be destroyed from close inside of the controller.
        }
      }
      reset();
      storage.clear();
      network.setXHR($);
      unregisterAll();
    }
  });

  test("email address prefills address field", function() {
    equal($("#email").val(), "registered@testuser.com", "email prefilled");
  });

  test("resetPassword raises 'reset_password' with email address", function() {
    register("reset_password", function(msg, info) {
      equal(info.email, "registered@testuser.com", "reset_password raised with correct email address");
      start();
    });

    controller.resetPassword();
    stop();
  });

  test("cancelResetPassword raises 'cancel_forgot_password'", function() {
    register("cancel_forgot_password", function(msg, info) {
      ok(true, "cancel_forgot_password triggered");
      start();
    });

    controller.cancelResetPassword();
    stop();

  });
});

