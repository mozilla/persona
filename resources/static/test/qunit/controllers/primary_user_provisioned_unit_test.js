/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
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

  var controller,
      bid = BrowserID,
      storage = bid.Storage,
      user = bid.User,
      network = bid.Network,
      testHelpers = bid.TestHelpers,
      register = testHelpers.register,
      xhr = bid.Mocks.xhr,
      mediator = bid.Mediator;

  module("controllers/primary_user_provisioned", {
    setup: function() {
      testHelpers.setup();
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
      testHelpers.setup();
    }
  });


  function createController(config) {
    controller = bid.Modules.PrimaryUserProvisioned.create();
    controller.start(config);
  }

  test("starting the controller without email throws assertion", function() {
    var error;

    try {
      createController({});
    }
    catch(e) {
      error = e;
    }

    equal(error, "missing config option: email", "correct error message printed");
  });

  test("starting the controller without assertion throws assertion", function() {
    var error;

    try {
      createController({email: "unregistered@testuser.com"});
    }
    catch(e) {
      error = e;
    }

    equal(error, "missing config option: assertion", "correct error message printed");
  });

  asyncTest("start controller with `add: false` and XHR error displays error screen", function() {
    xhr.useResult("ajaxError");

    createController({
      email: "unregistered@testuser.com",
      assertion: "test_assertion",
      add: false,
      ready: function(status) {
        equal(status, false, "correct status for XHR error");
        testHelpers.testErrorVisible();
        start();
      }
    });
  });

  asyncTest("start controller with `add: false` authenticates user", function() {
    register("email_chosen", function(msg, info) {
      network.checkAuth(function(status) {
        equal(status, true, "status is correct");
        start();
      });
    });

    xhr.useResult("valid");
    createController({
      email: "unregistered@testuser.com",
      add: false,
      assertion: "test_assertion",
      ready: function(status) {
        equal(true, status, "valid status");
      }
    });
  });

  asyncTest("start controller with `add: true` and XHR error displays error screen", function() {
    xhr.useResult("ajaxError");

    createController({
      email: "unregistered@testuser.com",
      assertion: "test_assertion",
      add: true,
      ready: function(status) {
        equal(status, false, "correct status for XHR error");
        testHelpers.testErrorVisible();
        start();
      }
    });
  });

  asyncTest("start controller with `add: true` adds email to user's list", function() {
    register("email_chosen", function(msg, info) {
      start();
    });

    xhr.useResult("valid");
    createController({
      email: "unregistered@testuser.com",
      add: true,
      assertion: "test_assertion",
      ready: function(status) {
        equal(true, status, "valid status");
      }
    });
  });

}());

