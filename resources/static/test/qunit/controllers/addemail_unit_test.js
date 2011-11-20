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
      user = bid.User,
      network = bid.Network,
      xhr = bid.Mocks.xhr,
      mediator = bid.Mediator, 
      modules = bid.Modules,
      testOrigin = "http://browserid.org",
      registrations = [];

  function register(message, cb) {
    registrations.push(mediator.subscribe(message, cb));
  }

  function unregisterAll() {
    var registration;
    while(registration = registrations.pop()) {
      mediator.unsubscribe(registration);
    }
  }

  module("controllers/addemail_controller", {
    setup: function() {
      network.setXHR(xhr);
      xhr.useResult("valid");
      storage.clear();
      user.setOrigin(testOrigin);
    },

    teardown: function() {
      if (controller) {
        try {
          controller.destroy();
          controller = null;
        } catch(e) {
          // could already be destroyed from the close
        }
      }    
      network.setXHR($);
      reset();
      storage.clear();
      unregisterAll();
    }
  });

  function createController(options) {
    controller = modules.AddEmail.create(options);
  }

  test("addemail controller renders correctly", function() {
    createController();

    equal($("#addEmail").length, 1, "control rendered correctly");
  });

  test("addEmail with valid email", function() {
    createController();

    $("#newEmail").val("unregistered@testuser.com");
    register("email_staged", function(msg, info) {
      equal(info.email, "unregistered@testuser.com", "email_staged called with correct email");
      start();
    });
    controller.addEmail();
    stop();
  });

  test("addEmail with valid email with leading/trailing whitespace", function() {
    createController();

    $("#newEmail").val("   unregistered@testuser.com  ");
    register("email_staged", function(msg, info) {
      equal(info.email, "unregistered@testuser.com", "email_staged called with correct email");
      start();
    });
    controller.addEmail();
    stop();
  });

  test("addEmail with invalid email", function() {
    createController();

    $("#newEmail").val("unregistered");
    var handlerCalled = false;
    register("email_staged", function(msg, info) {
      handlerCalled = true;
      ok(false, "email_staged should not be called on invalid email");
      start();
    });
    controller.addEmail();
    setTimeout(function() {
      equal(handlerCalled, false, "the email_staged handler should have never been called");
      start();
    }, 100);
    stop();
  });

  test("addEmail with previously registered email - allows for account consolidation", function() {
    createController();

    $("#newEmail").val("registered@testuser.com");
    register("email_staged", function(msg, info) {
      equal(info.email, "registered@testuser.com", "email_staged called with correct email");
      start();
    });
    controller.addEmail();
    stop();
  });

  test("cancelAddEmail", function() {
    createController();

    register("cancel_add_email", function(msg, info) {
      ok(true, "cancelling the add email");
      start();
    });
    controller.cancelAddEmail();
    stop();
  });

});
