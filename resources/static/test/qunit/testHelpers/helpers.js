(function() {
  var bid = BrowserID,
      mediator = bid.Mediator,
      network = bid.Network,
      storage = bid.Storage,
      xhr = bid.Mocks.xhr,
      screens = bid.Screens,
      registrations = [];
      calls = {};

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
      $("#error").html("<div class='contents'></div>").hide();

      unregisterAll();
      mediator.reset();
      screens.wait.hide();
      screens.error.hide();
    },

    teardown: function() {
      unregisterAll();
      mediator.reset();
      network.setXHR($);
      storage.clear();
      $("#error").html("<div class='contents'></div>").hide();
      screens.wait.hide();
      screens.error.hide();
    },

    register: register,
    errorVisible: function() {
      return screens.error.visible;
    },
    checkNetworkError: checkNetworkError
  };
}());
