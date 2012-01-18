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
      register = bid.TestHelpers.register,
      xhr = bid.Mocks.xhr,
      mediator = bid.Mediator,
      provisioning = bid.Mocks.Provisioning;

  module("controllers/provision_primary_user", {
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
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);

    mediator.subscribe("primary_user_provisioned", function(msg, info) {
      equal(info.email, "unregistered@testuser.com", "user is provisioned after requesting info from backend");
      start();
    });

    createController({
      email: "unregistered@testuser.com"
    });
  });
}());

