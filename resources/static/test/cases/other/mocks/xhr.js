/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  var bid = BrowserID,
      xhr = bid.Mocks.xhr,
      testHelpers = bid.TestHelpers;

  module("other/mocks/xhr", {
    setup: function() {
      testHelpers.setup();
    },

    teardown: function() {
      testHelpers.teardown();
    }
  });

  asyncTest("get with missing xhr request in xhr.js mock - should print out error on the console", function() {
    var origConsoleError = console.error,
        displayedError;

    console.error = function(msg) {
      displayedError = msg;
    };

    xhr.ajax({
      type: "get",
      url: "missing_url",
      error: function() {
        ok(displayedError, "console.error was called for a missing url");
        console.error = origConsoleError;
        start();
      }
    });
  });
}());
