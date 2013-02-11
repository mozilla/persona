
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.TestHelpers = (function() {
  "use strict";

  var bid = BrowserID,
      mediator = bid.Mediator,
      network = bid.Network,
      user = bid.User,
      storage = bid.Storage,
      xhr = bid.XHR,
      transport = bid.Mocks.xhr,
      provisioning = bid.Mocks.Provisioning,
      screens = bid.Screens,
      tooltip = bid.Tooltip,
      registrations = [],
      calls = {},
      testOrigin = "https://login.persona.org";

  function register(message, cb) {
    registrations.push(mediator.subscribe(message, function(msg, info) {
      if(calls[msg]) {
        throw msg + " triggered more than once";
      }
      calls[msg] = info || true;

      cb && cb.apply(null, arguments);
    }));
  }

  function unregisterAll() {
    for(var i = 0, registration; registration = registrations[i]; ++i) {
      mediator.unsubscribe(registration);
    }
    registrations = [];
    calls = {};
  }

  function checkNetworkError() {
    ok($("#error .contents").text().length, "contents have been written");
    ok($("#error #action").text().length, "action contents have been written");
    ok($("#error #network").text().length, "network contents have been written");
  }

  function clearStorage() {
    for(var key in localStorage) {
      localStorage.removeItem(key);
    }
  }

  var TestHelpers = {
    XHR_TIME_UNTIL_DELAY: 100,
    setup: function() {
      unregisterAll();
      mediator.reset();
      xhr.init({
        transport: transport,
        time_until_delay: TestHelpers.XHR_TIME_UNTIL_DELAY
      });

      transport.setDelay(0);
      transport.setContextInfo("auth_level", undefined);
      transport.setContextInfo("has_password", false);
      transport.useResult("valid");

      network.init({ cookiesEnabledOverride: true });
      clearStorage();

      $("body").stop().show();
      $("body")[0].className = "";

      $(".error").removeClass("error");
      $("#error").hide();
      $(".notification").stop().hide();
      $("form").show();
      screens.wait.hide();
      screens.error.hide();
      screens.delay.hide();
      tooltip.reset();
      provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
      user.reset();
      user.init({
        provisioning: provisioning
      });
      user.setOrigin(testOrigin);

    },

    teardown: function() {
      unregisterAll();
      mediator.reset();
      xhr.init({
        transport: $,
        time_until_delay: 10 * 1000
      });
      network.init();
      clearStorage();
      screens.wait.hide();
      screens.error.hide();
      screens.delay.hide();
      tooltip.reset();
      provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
      user.reset();
    },

    testOrigin: testOrigin,

    register: register,
    isTriggered: function(message) {
      return message in calls;
    },

    testTriggered: function(message, expectedFields) {
      ok(message in calls, message + " was triggered");
      if (expectedFields) this.testObjectValuesEqual(calls[message], expectedFields);
    },

    expectedMessage: function(message, expectedFields) {
    // keep track of the original start function.  When the start function is
    // called, call the proxy start function and then the original start
    // function.  This allows proxy start functions to be chained and multiple
    // expectedMessages to be called.
    start = function(origStart) {
      TestHelpers.testTriggered(message, expectedFields);
      start = origStart;
      start();
    }.bind(null, start);

    register(message);
  },

  unexpectedMessage: function(message) {
    // keep track of the original start function.  When the start function is
    // called, call the proxy start function and then the original start
    // function.  This allows proxy start functions to be chained and multiple
    // expectedMessages to be called.
    start = function(origStart) {
      equal(TestHelpers.isTriggered(message), false, message + " was not triggered");
      start = origStart;
      start();

    }.bind(null, start);
    register(message);
  },


    errorVisible: function() {
      return screens.error.visible;
    },

    testErrorVisible: function() {
      equal(TestHelpers.errorVisible(), true, "error screen is visible");
    },

    testErrorNotVisible: function() {
      equal(TestHelpers.errorVisible(), false, "error screen is not visible");
    },

    waitVisible: function() {
      return screens.wait.visible;
    },

    testWaitVisible: function() {
      equal(TestHelpers.waitVisible(), true, "wait screen is visible");
    },

    delayVisible: function() {
      return screens.delay.visible;
    },

    testDelayVisible: function() {
      equal(TestHelpers.delayVisible(), true, "delay screen is visible");
    },

    checkNetworkError: checkNetworkError,
    unexpectedSuccess: function() {
      ok(false, "unexpected success");
      start();
    },

    expectedFailure: function() {
      ok(true, "expected failure");
      start();
    },

    unexpectedFailure: function() {
      ok(false, "unexpected failure");
      start();
    },

    expectedXHRFailure: function() {
      ok(true, "expected XHR failure");
      start();
    },

    unexpectedXHRFailure: function() {
      ok(false, "unexpected XHR failure");
      start();
    },

    testTooltipVisible: function() {
      equal(tooltip.visible(), true, "tooltip is visible");
    },

    testTooltipNotVisible: function() {
      equal(tooltip.visible(), false, "tooltip is not visible");
    },

    failureCheck: function failureCheck(cb) {
      // Take the original arguments, take off the function.  Add any additional
      // arguments that were passed in, and then tack on the onSuccess and
      // onFailure to the end.  Then call the callback.
      var args = [].slice.call(arguments, 1);

      var errorInfo;

      args.push(bid.TestHelpers.unexpectedSuccess, function onFailure(info) {
        ok(true, "XHR failure should never pass");
        ok(info.network.url, "url is in network info");
        ok(info.network.type, "request type is in network info");
        equal(info.network.textStatus, "errorStatus", "textStatus is in network info");
        equal(info.network.errorThrown, "errorThrown", "errorThrown is in response info");

        start();
      });

      if(transport.responseName === "valid") {
        transport.useResult("ajaxError");
      }

      cb && cb.apply(null, args);
    },

    /**
     * Generate a long string
     */
    generateString: function(length) {
      var str = "";
      for(var i = 0; i < length; i++) {
        str += (i % 10);
      }
      return str;
    },

    testKeysInObject: function(objToTest, expected, msg) {
      if (!objToTest) ok(false, "missing objToTest");
      if (!expected) ok(false, "missing objToTest");

      for(var i=0, key; key=expected[i]; ++i) {
        ok(key in objToTest, msg || ("object contains " + key));
      }
    },

    testObjectValuesEqual: function(objToTest, expected, msg) {
      if (!objToTest) ok(false, "missing objToTest");
      if (!expected) ok(false, "missing objToTest");

      for(var key in expected) {
        deepEqual(objToTest[key], expected[key], key + " set to: " + expected[key] + (msg ? " - " + msg : ""));
      }
    },

    testUndefined: function(toTest, msg) {
      equal(typeof toTest, "undefined", msg || "object is undefined");
    },

    testNotUndefined: function(toTest, msg) {
      notEqual(typeof toTest, "undefined", msg || "object is defined");
    },

    testVisible: function(selector, msg) {
      ok($(selector).is(":visible"), msg || selector + " is visible");
    },

    testNotVisible: function(selector, msg) {
      equal($(selector).is(":visible"), false, msg || selector + " is not visible");
    },

    testHasClass: function(selector, className, msg) {
      ok($(selector).hasClass(className),
          msg || (selector + " has className " + className));
    },

    testNotHasClass: function(selector, className, msg) {
      ok(!$(selector).hasClass(className),
          msg || (selector + " does not have className " + className));
    },

    testElementExists: function(selector, msg) {
      ok($(selector).length, msg || ("element '" + selector + "' exists"));
    },

    testElementDoesNotExist: function(selector, msg) {
      ok(!$(selector).length, msg || ("element '" + selector + "' does not exist"));
    },

    testRPTosPPShown: function(msg) {
      TestHelpers.testHasClass("body", "rptospp", msg || "RP TOS/PP shown");
    },

    testRPTosPPNotShown: function(msg) {
      TestHelpers.testNotHasClass("body", "rptospp", msg || "RP TOS/PP not shown");
    },

    testElementChecked: function(selector, msg) {
      equal($(selector).is(":checked"), true, msg || selector + " is checked");
    },

    testElementNotChecked: function(selector, msg) {
      equal($(selector).is(":checked"), false, msg || selector + " is not checked");
    },

    testElementFocused: function(selector, msg) {
      var focusedEl = $(":focus");

      if ($(selector).is(":focus")) {
        ok(true, msg || selector + " is focused");
      }
      else {
        // In some environments such as PhantomJS, input elements cannot be
        // checked for focus.  Make a temporary input element which we can
        // check to see if it is possible to focus. If it is possible, this is
        // a failure.  If it is not possible, print a message and continue.
        // Remove the element when complete.
        var input = $("<input type='radio' />").appendTo("body").focus();
        if (input.is(":focus")) {
          ok(false, msg || selector + " is focused");
          // refocus the original input element.
          if (focusedEl.length) $(focusedEl).focus();
        }
        else {
          window.console && console.log("currently unable to focus elements, focus check skipped - try focusing the unit test page");
        }
        input.remove();
      }
    },

    testElementTextContains: function(selector, expected, msg) {
      var el = $(selector).eq(0),
          elText = (el && el.text()) || "";

      ok(elText.indexOf(expected) > -1, msg || (selector + " text contains: " + expected));
    },

    testElementTextEquals: function(selector, expected, msg) {
      var el = $(selector).eq(0),
          elText = (el && el.text()) || "";

      equal(elText, expected, msg || (selector + " text is: " + expected));
    },

    testEmailMarkedVerified: function(email, msg) {
      var emailInfo = storage.getEmail(email);
      equal(emailInfo && emailInfo.verified, true,
        "verified bit set for " + email);
    },

    testDocumentRedirected: function(doc, expectedHref, msg) {
      equal(doc.location, expectedHref, msg || "document redirected to " + expectedHref);
    },

    testDocumentNotRedirected: function(doc, msg) {
      equal(doc.location.href, document.location.href, msg || "document not redirected");

    },

    testAddressesSyncedAfterUserRegistration: function(msg) {
      function checkEmail(email) {
        ok(user.getStoredEmailKeypair(email), msg || email + " has been synced");
      }

      checkEmail("registered@testuser.com");
      checkEmail("synced_address@testuser.com");
    },

    testInvalidAuthenticationPassword: function(msg, testInvalidPassword) {
      if (!testInvalidPassword) {
        testInvalidPassword = msg;
        msg = "";
      }
      else {
        msg = msg + " ";
      }

      asyncTest(msg + "missing password does not authenticate", function() {
        testInvalidPassword("");
      });

      asyncTest(msg + "too short of a password does not authenticate", function() {
        testInvalidPassword(TestHelpers.generateString(
            bid.PASSWORD_MIN_LENGTH - 1));
      });

      asyncTest(msg + "too long of a password does not authenticate", function() {
        testInvalidPassword(TestHelpers.generateString(
            bid.PASSWORD_MAX_LENGTH + 1));
      });
    },

    testInvalidPasswordAndValidationPassword: function(msg, testInvalidPassword) {
      if (!testInvalidPassword) {
        testInvalidPassword = msg;
        msg = "";
      }
      else {
        msg = msg + " ";
      }

      asyncTest(msg + "missing password", function() {
        testInvalidPassword("", "password");
      });

      asyncTest(msg + "too short of a password", function() {
        testInvalidPassword(
            TestHelpers.generateString(bid.PASSWORD_MIN_LENGTH - 1));
      });

      asyncTest(msg + "too long of a password", function() {
        testInvalidPassword(
            TestHelpers.generateString(bid.PASSWORD_MAX_LENGTH + 1));
      });

      asyncTest(msg + "missing vpassword", function() {
        testInvalidPassword("password", "");
      });

      asyncTest(msg + "password, vpassword mismatch", function() {
        testInvalidPassword("password", "different_password");
      });

    }
  };

  return TestHelpers;
}());
