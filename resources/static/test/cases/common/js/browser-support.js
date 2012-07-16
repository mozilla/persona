/*jshint browser: true, forin: true, laxbreak: true */
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

  module("common/js/browser-support", {
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

  test("isIOS with userAgent that is not iOS - return false", function() {
    stubNavigator.appName = "Netscape";
    stubNavigator.userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.7; rv:14.0) Gecko/20120326 Firefox/14.0a1";

    strictEqual(support.isIOS(), false, "false returned for Firefox userAgent");
  });

  test("isIOS with userAgent that is iOS - return true", function() {
    stubNavigator.userAgent = "Mozilla/5.0 (iPod; U; CPU iPhone OS 4_3_3 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8J2 Safari/6533.18.5";

    strictEqual(support.isIOS(), true, "true returned for iOS userAgent");
  });

}());


