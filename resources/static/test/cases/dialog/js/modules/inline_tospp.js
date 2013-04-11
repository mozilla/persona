/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      InlineTosPp = bid.Modules.InlineTosPp,
      testHelpers = bid.TestHelpers;

  function createController(options) {
    options = options || {};
    controller = InlineTosPp.create();
    controller.start(options);
  }

  module("dialog/js/modules/inline_tospp", {
    setup: function() {
      testHelpers.setup();
    },
    teardown: function() {
      testHelpers.teardown();
      if (controller) {
        try {
          controller.destroy();
        } catch(e) {
          // may already be destroyed from close inside of the controller.
        }
      }
    }
  });

  asyncTest("can create and show", function() {
    createController({
      ready: function() {
        controller.show("https://login.persona.org/privacy");
        equal($("#tosppmodal:visible").length, 1);

        controller.close();
        equal($("#tosppmodal:visible").length, 0);

        controller.remove();
        equal($("#tosppmodal").length, 0);

        start();
      }
    });
  });

}());

