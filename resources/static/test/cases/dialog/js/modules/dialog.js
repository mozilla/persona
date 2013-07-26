/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      channel = bid.Channel,
      network = bid.Network,
      mediator = bid.Mediator,
      testHelpers = bid.TestHelpers,
      testErrorVisible = testHelpers.testErrorVisible,
      testErrorNotVisible = testHelpers.testErrorNotVisible,
      screens = bid.Screens,
      xhr = bid.Mocks.xhr,
      user = bid.User,
      storage = bid.Storage,
      HTTP_TEST_DOMAIN = "http://testdomain.org",
      HTTPS_TEST_DOMAIN = "https://testdomain.org",
      TESTEMAIL = "testuser@testuser.com",
      controller,
      el,
      winMock,
      navMock;

  function WinMock() {
    // Oh so beautiful.
    this.opener = {
      frames: {
        1234: {
          BrowserID: {
            Relay: {
              registerClient: function() {
              },

              unregisterClient: function() {
              }
            }
          }
        }
      }
    };
    this.location = {
      hash: "#1234"
    };
    this.navigator = {};
  }

  function createController(config) {
    // startExternalDependencies defaults to true, for most of our tests we
    // want to turn this off to prevent the state machine, channel, and actions
    // controller from starting up and throwing errors.  This allows us to test
    // dialog as an individual unit.
    var options = $.extend({
      window: winMock,
      startExternalDependencies: false
    }, config);

    controller = BrowserID.Modules.Dialog.create();
    controller.start(options);
  }

  function testMessageNotExpected(msg) {
    mediator.subscribe(msg, function(msg, info) {
      ok(false, "unexpected message: " + msg);
    });
  }

  function testExpectGetFailure(options, expectedErrorMessage, domain) {
    _.extend(options, {
      ready: function() {
        testMessageNotExpected("kpi_data");
        testMessageNotExpected("start");

        var retval = controller.get(domain || HTTPS_TEST_DOMAIN, options);

        if (expectedErrorMessage) {
          equal(retval.message, expectedErrorMessage, "expected error: " + expectedErrorMessage);
        }
        else {
          ok(retval instanceof Error, "error message returned");
        }

        // If a parameter is not properly escaped, scriptRun will be true.
        equal(typeof window.scriptRun, "undefined", "script was not run");

        testErrorVisible();
        start();
      }
    });
    createController(options);
  }

  function testRelativeURLNotAllowed(options, path) {
    testExpectGetFailure(options, "relative urls not allowed: (" + path + ")");
  }

  function testExpectGetSuccess(options, expected, domain, done) {
    createController({
      ready: function() {
        var startInfo;
        mediator.subscribe("start", function(msg, info) {
          startInfo = info;
        });

        var retval = controller.get(domain || HTTPS_TEST_DOMAIN, options);
        testHelpers.testObjectValuesEqual(startInfo, expected);

        equal(typeof retval, "undefined", "no error expected");
        testErrorNotVisible();

        done && done();

        start();
      }
    });
  }


  module("dialog/js/modules/dialog", {
    setup: function() {
      winMock = new WinMock();
      testHelpers.setup();
    },

    teardown: function() {
      controller.destroy();
      testHelpers.teardown();
    }
  });

  asyncTest("initialization with channel error", function() {
    // Set the hash so that the channel cannot be found.
    winMock.location.hash = "#1235";
    createController({
      startExternalDependencies: true,
      ready: function() {
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("initialization with add-on navigator.id.channel", function() {
    var registerControllerCalled = false;

    // expect registerController to be called.
    winMock.navigator.id = {
      channel : {
        registerController: function(controller) {
          registerControllerCalled = !!controller.get;
        }
      }
    };

    createController({
      startExternalDependencies: true,
      ready: function() {
        ok(registerControllerCalled, "registerController was not called with proper controller");
        start();
      }
    });
  });

  asyncTest("initialization with #NATIVE", function() {
    winMock.location.hash = "#NATIVE";

    createController({
      startExternalDependencies: true,
      ready: function() {
        testErrorNotVisible();
        start();
      }
    });
  });


  asyncTest("initialization with #INTERNAL", function() {
    winMock.location.hash = "#INTERNAL";

    createController({
      startExternalDependencies: true,
      ready: function() {
        testErrorNotVisible();
        start();
      }
    });
  });

  asyncTest("initialization with RP redirect flow - " +
      "immediately calls get (which triggers an error)", function() {
    storage.rpRequest.set({
      origin: "testuser.com",
      params: {
        returnTo: "/"
      }
    });

    var err;
    mediator.subscribe("error_screen", function(msg, info) {
      err = info.message;
    });

    createController({
      startExternalDependencies: true,
      ready: function() {
        equal(err, "Error: module not registered for rp_info");
        start();
      }
    });
  });



  function testReturnFromIdP(verificationInfo, expectedParams) {
    storage.idpVerification.set(verificationInfo);

    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          testHelpers.testObjectValuesEqual(info, expectedParams);
          start();
        });

        try {
          controller.get(testHelpers.testOrigin, {}, function() {}, function() {});
        }
        catch(e) {
          // do nothing, an exception will be thrown because no modules are
          // registered for the any services.
        }
      }
    });
  }

  asyncTest("initialization with #AUTH_RETURN_CANCEL - " +
      " trigger start with cancelled=true", function() {
    winMock.location.hash = "#AUTH_RETURN_CANCEL";
    testReturnFromIdP({
      email: TESTEMAIL
    }, {
      cancelled: true,
      type: "primary",
      email: TESTEMAIL
    });
  });

  asyncTest("initialization with #AUTH_RETURN and add=false - trigger start with correct params", function() {
    winMock.location.hash = "#AUTH_RETURN";
    testReturnFromIdP({
      add: false,
      email: TESTEMAIL
    }, {
      type: "primary",
      email: TESTEMAIL,
      add: false,
      cancelled: false
    });
  });

  asyncTest("initialization with #AUTH_RETURN and add=true - trigger start with correct params", function() {
    winMock.location.hash = "#AUTH_RETURN";
    testReturnFromIdP({
      add: true,
      email: TESTEMAIL
    }, {
      type: "primary",
      email: TESTEMAIL,
      add: true,
      cancelled: false
    });
  });


  asyncTest("#AUTH_RETURN while authenticated should call usedAddressAsPrimary", function() {
    winMock.location.hash = "#AUTH_RETURN";
    storage.idpVerification.set({
      add: false,
      email: TESTEMAIL
    });
    xhr.setContextInfo("authenticated", true);
    xhr.setContextInfo("auth_level", "assertion");

    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          var req = xhr.getLastRequest();
          equal(req && req.url, "/wsapi/used_address_as_primary", "sent correct request");
          start();
        });

        try {
          controller.get(testHelpers.testOrigin, {}, function() {}, function() {});
        }
        catch(e) {
          // do nothing, an exception will be thrown because no modules are
          // registered for the any services.
        }
      }
    });
  });

  asyncTest("#AUTH_RETURN with add=true should not call usedAddressAsPrimary", function() {
    winMock.location.hash = "#AUTH_RETURN";
    storage.idpVerification.set({
      add: true,
      email: TESTEMAIL
    });
    xhr.setContextInfo("authenticated", true);
    xhr.setContextInfo("auth_level", "assertion");
    delete xhr.request;

    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          var req = xhr.getLastRequest();
          notEqual(req && req.url, "/wsapi/used_address_as_primary", "request should not be sent");
          start();
        });

        try {
          controller.get(testHelpers.testOrigin, {}, function() {}, function() {});
        }
        catch(e) {
          // do nothing, an exception will be thrown because no modules are
          // registered for the any services.
        }
      }
    });
  });

  asyncTest("onWindowUnload", function() {
    createController({
      ready: function() {
        var error;

        try {
          controller.onWindowUnload();
        }
        catch(e) {
          error = e;
        }

        equal(typeof error, "undefined", "unexpected error thrown when unloading window (" + error + ")");
        start();
      }
    });
  });


  asyncTest("get with invalid RP parameter (termsOfService) - print error screen", function() {
    testRelativeURLNotAllowed({
      termsOfService: "relative.html",
      privacyPolicy: "/privacy.html"
    }, "relative.html");
  });



  asyncTest("get with valid RP parameters - go to start", function() {
    testExpectGetSuccess({
      termsOfService: "/tos.html",
      privacyPolicy: "/privacy.html"
    },
    {
      termsOfService: HTTPS_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTPS_TEST_DOMAIN + "/privacy.html"
    });
  });

  asyncTest("get with valid rp_api parameters - go to start, set rp_api in KPIs", function() {
    var receivedKPIs;
    mediator.subscribe("kpi_data", function(msg, info) {
      receivedKPIs = info;
    });

    testExpectGetSuccess({
      rp_api: "get"
    },
    {
      rpAPI: "get"
    }, HTTPS_TEST_DOMAIN, function() {
      equal(receivedKPIs.rp_api, "get");
    });
  });

  asyncTest("get with returnTo - set returnTo in user", function() {
    testExpectGetSuccess({
      returnTo: "/return.html"
    },
    {
      returnTo: HTTPS_TEST_DOMAIN + "/return.html"
    }, HTTPS_TEST_DOMAIN, function() {
      equal(user.getReturnTo(), HTTPS_TEST_DOMAIN + "/return.html");
    });
  });


  asyncTest("get with start_time - publish start_time with start time", function() {
    var now = new Date().getTime();

    var receivedStartTime;
    mediator.subscribe("start_time", function(msg, startTime) {
      receivedStartTime = startTime;
    });

    testExpectGetSuccess({
      start_time: now.toString()
    },
    {
      startTime: now
    }, HTTPS_TEST_DOMAIN, function() {
      equal(receivedStartTime, now);
    });
  });


}());
