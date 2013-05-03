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
    // Travis-CI uses PhantomJS 1.8.1 which contains a crash bug when appending
    // and removing an iframe. The Phantom bug is tracked at:
    // https://github.com/ariya/phantomjs/issues/10947
    // The Travis bug is tracked at:
    // https://github.com/travis-ci/travis-ci/issues/1074
    // When Travis updates its version of Phantom, this can be removed.
    options.no_iframe = true;
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
        var url = "https://login.persona.org/privacy";
        controller.show(url);
        equal($("#tosppmodal:visible").length, 1);

        equal($("#tosppframe").attr('src'), url);

        controller.close();
        equal($("#tosppmodal:visible").length, 0);

        controller.remove();
        equal($("#tosppmodal").length, 0);

        start();
      }
    });
  });

}());

