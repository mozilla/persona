/*jshint browsers:true, forin: true, laxbreak: true */
/*global steal: true, test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID: true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
steal.plugins("jquery", "funcunit/qunit").then(function() {
  "use strict";

  var bid = BrowserID,
      support = bid.BrowserSupport,
      stubWindow,
      stubNavigator;

  module("browser-support", {
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
});


