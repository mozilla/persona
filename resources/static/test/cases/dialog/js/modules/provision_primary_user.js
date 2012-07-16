/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      storage = bid.Storage,
      user = bid.User,
      network = bid.Network,
      register = bid.TestHelpers.register,
      xhr = bid.Mocks.xhr,
      mediator = bid.Mediator,
      provisioning = bid.Mocks.Provisioning;

  module("dialog/js/modules/provision_primary_user", {
    setup: function() {
      bid.TestHelpers.setup();
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
      bid.TestHelpers.setup();
    }
  });


  function createController(config) {
    controller = bid.Modules.ProvisionPrimaryUser.create();
    controller.start(config);
  }

  test("create controller with missing email throws error", function() {
    var error;

    try {
      createController({
        auth: "https://auth_url",
        prov: "https://prov_url"
      });
    } catch(e) {
      error = e;
    }

    equal(error, "missing config option: email", "must specify email, auth, and prov");
  });

  asyncTest("create controller with all fields specified, user authenticated with primary - expected user provisioned", function() {
    provisioning.setStatus(provisioning.AUTHENTICATED);
    xhr.useResult("primary");

    mediator.subscribe("primary_user_provisioned", function(msg, info) {
      ok(info.assertion, "assertion available");
      equal(info.email, "unregistered@testuser.com", "email available");
      start();
    });

    createController({
      email: "unregistered@testuser.com",
      auth: "https://auth_url",
      prov: "https://prov_url"
    });
  });

  asyncTest("create controller with all fields specified, user not authenticated with primary - expected user must authenticate", function() {
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
    xhr.useResult("primary");

    mediator.subscribe("primary_user_unauthenticated", function(msg, info) {
      equal(info.auth_url, "https://auth_url", "primary information fetched");
      start();
    });

    createController({
      email: "unregistered@testuser.com",
      auth: "https://auth_url",
      prov: "https://prov_url"
    });
  });

  asyncTest("create controller with missing auth/prov, user authenticated with primary - expected to request provisioning info from backend, user provisioned", function() {
    provisioning.setStatus(provisioning.AUTHENTICATED);
    xhr.useResult("primary");

    mediator.subscribe("primary_user_provisioned", function(msg, info) {
      equal(info.email, "unregistered@testuser.com", "user is provisioned after requesting info from backend");
      start();
    });

    createController({
      email: "unregistered@testuser.com"
    });
  });
}());

