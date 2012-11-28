/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
console.log('loading');
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      modules = bid.Modules,
      testHelpers = bid.TestHelpers;


  module("dialog/js/modules/upgrade_to_primary_user", {
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
      testHelpers.teardown();
    }
  });

  function createController(options) {
    controller = modules.UpgradeToPrimaryUser.create();
    controller.start(options || {});
  }

  test("Render dialog", function() {
    createController({
      email: 'transitioningS2P@testuser.com',
      auth_url: 'https://testuser.com/auth',
      idpName: 'testuser.com'
    });
    var copy = $('#your_computer_content').html();
    ok(copy.length > 0, "We have some copy");
    ok(copy.indexOf('redirect you to testuser.com') > 0, "idPName shows up");
  });
}());

