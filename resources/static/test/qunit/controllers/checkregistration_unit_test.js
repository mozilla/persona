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
      el,
      bid = BrowserID,
      xhr = bid.Mocks.xhr,
      network = bid.Network,
      mediator = bid.Mediator,
      listeners = [];

  function subscribe(message, cb) {
    listeners.push(mediator.subscribe(message, cb));
  }

  function unsubscribeAll() {
    var registration;
    while(registration = listeners.pop()) {
      mediator.unsubscribe(registration);
    }
  }

  function createController(verifier, message) {
    el = $("body");
    controller = bid.Modules.CheckRegistration.create({
      email: "registered@testuser.com",
      verifier: verifier,
      verificationMessage: message
    });
  }

  module("controllers/checkregistration_controller", {
    setup: function() {
      xhr.useResult("valid");
      network.setXHR(xhr);
      $("#error").hide();
    },

    teardown: function() {
      network.setXHR($);
      if (controller) {
        try {
          // Controller may have already destroyed itself.
          controller.destroy();
        } catch(e) {}
      }
      unsubscribeAll();
      $("#error").hide();
    } 
  });

  function testVerifiedUserEvent(event_name, message) {
    createController("waitForUserValidation", event_name);
    subscribe(event_name, function() {
      ok(true, message);
      start();
    });
    controller.startCheck();

    stop();
  }

  test("user validation with mustAuth result", function() {
    xhr.useResult("mustAuth");

    testVerifiedUserEvent("auth", "User Must Auth");
  });

  test("user validation with pending->complete result ~3 seconds", function() {
    xhr.useResult("pending");

    testVerifiedUserEvent("user_verified", "User verified");
    setTimeout(function() {
      xhr.useResult("complete");
    }, 1000);
  });

  test("user validation with XHR error", function() {
    xhr.useResult("ajaxError");

    createController("waitForUserValidation", "user_verified");
    subscribe("user_verified", function() {
      ok(false, "on XHR error, should not complete");
    });
    controller.startCheck();
    
    setTimeout(function() {
      ok($("#error").is(":visible"), "Error message is visible");
      start();
    }, 1000);

    stop();
  });

  test("cancel raises cancel_user_verified", function() {
    createController("waitForUserValidation", "user_verified");
    subscribe("cancel_user_verified", function() {
      ok(true, "on cancel, cancel_user_verified is triggered");
      start();
    });
    controller.startCheck();
    controller.cancel();

    stop();
  });

});

