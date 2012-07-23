/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      testHelpers = bid.TestHelpers,
      Command = bid.Command,
      History = bid.History,
      history;

  module("common/js/history", {
    setup: function() {
      testHelpers.setup();
      history = History.create();
    },

    teardown: function() {
      testHelpers.teardown();
      history.destroy();
    }
  });

  test("createState, getCurrent - create a state, get the command", function() {
    var cmd = history.createState(function() {});

    var current = history.getCurrent();

    strictEqual(cmd, current, "createState returns same item as getCurrent");
  });

  test("createState, saveState - save current state to the stack", function() {
    var cmd = history.createState(function() {});

    history.saveState();
    var topState = history.getTop();

    strictEqual(cmd, topState, "createState returns same item as getCurrent");
  });

  asyncTest("popState - remove item from stack, make it current", function() {
      var cmd1 = history.createState(function() {
        ok(true, "correct item run");
        start();
      });

      history.saveState();

      var cmd2 = history.createState(function() {
        ok(false, "incorrect item run");
        start();
      });

      history.popState();
      var current = history.getCurrent();
      current.run();
  });

}());
