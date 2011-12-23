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

      cb(msg, info);
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
    }
  };
}());
