/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  var bid = BrowserID,
      mediator = bid.Mediator,
      network = bid.Network,
      user = bid.User,
      storage = bid.Storage,
      xhr = bid.Mocks.xhr,
      provisioning = bid.Mocks.Provisioning,
      screens = bid.Screens,
      tooltip = bid.Tooltip,
      registrations = [];
      calls = {},
      testOrigin = "https://browserid.org";

  function register(message, cb) {
    registrations.push(mediator.subscribe(message, function(msg, info) {
      if(calls[msg]) {
        throw msg + " triggered more than once";
      }
      calls[msg] = true;

      cb && cb(msg, info);
    }));
  }

  function unregisterAll() {
    var registration;
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

  BrowserID.TestHelpers = {
    setup: function() {
      network.setXHR(xhr);
      xhr.setContextInfo("auth_level", undefined);
      xhr.useResult("valid");
      storage.clear();

      var el = $("#controller_head");
      el.find("#formWrap .contents").html("");
      el.find("#wait .contents").html("");
      $(".error").removeClass("error");
      $("#error").stop().html("<div class='contents'></div>").hide();
      $(".notification").stop().hide();
      $("form").show();
      unregisterAll();
      mediator.reset();
      screens.wait.hide();
      screens.error.hide();
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
      network.setXHR($);
      storage.clear();
      $(".error").removeClass("error");
      $("#error").stop().html("<div class='contents'></div>").hide();
      $(".notification").stop().hide();
      $("form").show();
      screens.wait.hide();
      screens.error.hide();
      tooltip.reset();
      provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
      user.reset();
    },

    testOrigin: testOrigin,

    register: register,
    isTriggered: function(message) {
      return calls[message];
    },
    errorVisible: function() {
      return screens.error.visible;
    },
    testErrorVisible: function() {
      equal(this.errorVisible(), true, "error screen is visible");
    },
    checkNetworkError: checkNetworkError,
    unexpectedSuccess: function() {
      ok(false, "unexpected success");
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
      equal(tooltip.shown, true, "tooltip is visible");
    },

    failureCheck: function failureCheck(cb) {
      // Take the original arguments, take off the function.  Add any additional
      // arguments that were passed in, and then tack on the onSuccess and
      // onFailure to the end.  Then call the callback.
      var args = [].slice.call(arguments, 1);

      var errorInfo;
      mediator.subscribe("xhrError", function(message, info) {
        errorInfo = info;
      });

      args.push(bid.TestHelpers.unexpectedSuccess, function onFailure(info) {
        ok(true, "XHR failure should never pass");
        ok(info.network.url, "url is in network info");
        ok(info.network.type, "request type is in network info");
        equal(info.network.textStatus, "errorStatus", "textStatus is in network info");
        equal(info.network.errorThrown, "errorThrown", "errorThrown is in response info");

        ok(errorInfo.network.url, "url is in network errorInfo");
        ok(errorInfo.network.type, "request type is in network errorInfo");
        equal(errorInfo.network.textStatus, "errorStatus", "textStatus is in network errorInfo");
        equal(errorInfo.network.errorThrown, "errorThrown", "errorThrown is in response errorInfo");
        equal(errorInfo.network.responseText, "response text", "responseText is in response errorInfo");

        start();
      });

      if(xhr.resultType === "valid") {
        xhr.useResult("ajaxError");
      }

      cb && cb.apply(null, args);
    }

  };
}());
