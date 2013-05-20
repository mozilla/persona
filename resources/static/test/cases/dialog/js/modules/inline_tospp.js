/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      InlineTosPp = bid.Modules.InlineTosPp,
      WindowMock = bid.Mocks.WindowMock,
      testHelpers = bid.TestHelpers,
      TOSPP_URL = "https://login.persona.org/privacy";

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

  // Simulate opening new windows in a normal browser.
  asyncTest("window.open opens new window - show tos/pp in new window",
      function() {

    var winMock = new WindowMock({
      suppressOpen: false
    });

    createController({
      window: winMock,
      ready: function() {
        controller.show(TOSPP_URL);
        equal($("#tosppmodal:visible").length, 0);

        equal(winMock.open_url, TOSPP_URL);

        start();
      }
    });
  });

  // Simulate FirefoxOS where new windows cannot be opened.
  asyncTest("window.open does not open new window - show tos/pp in iframe",
      function() {
    var winMock = new WindowMock({
      suppressOpen: true
    });

    createController({
      window: winMock,
      ready: function() {
        controller.show(TOSPP_URL);
        equal($("#tosppmodal:visible").length, 1);

        equal($("#tosppframe").attr('src'), TOSPP_URL);

        controller.close();
        equal($("#tosppmodal:visible").length, 0);

        controller.remove();
        equal($("#tosppmodal").length, 0);

        start();
      }
    });
  });

}());

