/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      support = bid.BrowserSupport,
      stubWindow,
      stubNavigator;

  module("shared/browser-support", {
    setup: function() {
      // Hard coded goodness for testing purposes
      stubNavigator = {
        appName: "Netscape",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.7; rv:7.0.1) Gecko/20100101 Firefox/7.0.1"
      };

      stubWindow = {
        localStorage: {},
        postMessage: function() {}
      };

      support.setTestEnv(stubNavigator, stubWindow);
    },

    teardown: function() {
    }
  });

  test("browser without localStorage", function() {
    delete stubWindow.localStorage;

    equal(support.isSupported(), false, "window.localStorage is required");
    equal(support.getNoSupportReason(), "LOCALSTORAGE", "correct reason");
  });


  test("browser without postMessage", function() {
    delete stubWindow.postMessage;

    equal(support.isSupported(), false, "window.postMessage is required");
    equal(support.getNoSupportReason(), "POSTMESSAGE", "correct reason");
  });

  test("Fake being IE8 - unsupported intentionally", function() {
    stubNavigator.appName = "Microsoft Internet Explorer";
    stubNavigator.userAgent = "MSIE 8.0";

    equal(support.isSupported(), false, "IE8 is not supported");
    equal(support.getNoSupportReason(), "IE_VERSION", "correct reason");
  });

  test("Fake being IE9 - supported", function() {
    stubNavigator.appName = "Microsoft Internet Explorer";
    stubNavigator.userAgent = "MSIE 9.0";

    equal(support.isSupported(), true, "IE9 is supported");
    equal(typeof support.getNoSupportReason(), "undefined", "no reason, we are all good");
  });

  test("Firefox 7.01 with postMessage, localStorage", function() {
    equal(support.isSupported(), true, "Firefox 7.01 is supported");
    equal(typeof support.getNoSupportReason(), "undefined", "no reason, we are all good");
  });
}());


