/*jshint browser: true*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      testHelpers = bid.TestHelpers,
      cryptoLoader = bid.CryptoLoader;

  module("common/js/crypto-loader", {
    setup: function() {
      testHelpers.setup();
    },
    teardown: function() {
      testHelpers.teardown();
    }
  });

  asyncTest("load gets jwcrypto", function() {
    cryptoLoader.load(function(jwcrypto) {
      ok(jwcrypto);

      start();
    }, testHelpers.unexpectedFailure);
  });

}());

