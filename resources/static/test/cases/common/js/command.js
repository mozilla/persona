/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      testHelpers = bid.TestHelpers,
      Command = bid.Command;

  module("common/js/command", {
    setup: function() {
      testHelpers.setup();
    },

    teardown: function() {
      testHelpers.teardown();
    }
  });

  asyncTest("run - run_options passed to callback", function() {
    var cmd = Command.create({
      callback: function(options) {
        equal(options.item, "value", "correct options sent");
        start();
      },
      run_options: {
        item: "value"
      }
    });

    cmd.run();
  });

  asyncTest("extendRunOptions, run - run_options extended, passed to callback", function() {
    var cmd = Command.create({
      callback: function(options) {
        equal(options.item, "value", "correct options sent");
        start();
      }
    });

    cmd.extendRunOptions({ item: "value" });
    cmd.run();
  });
}());
