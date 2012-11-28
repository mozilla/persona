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
      HTTP_TEST_DOMAIN = "http://testdomain.org",
      HTTPS_TEST_DOMAIN = "https://testdomain.org",
      TESTEMAIL = "testuser@testuser.com",
      controller,
      el,
      winMock,
      navMock;

  function WinMock() {
    this.location.hash = "#1234";
  }

  WinMock.prototype = {
    // Oh so beautiful.
    opener: {
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
    },

    location: {
    },

    navigator: {},

    sessionStorage: {}
  };

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

  function testMustBeAbsolutePath(options, path) {
    testExpectGetFailure(options, "must be an absolute path: (" + path + ")");
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
      ready: function() {
        testErrorNotVisible();
        start();
      }
    });
  });


  asyncTest("initialization with #INTERNAL", function() {
    winMock.location.hash = "#INTERNAL";

    createController({
      ready: function() {
        testErrorNotVisible();
        start();
      }
    });
  });

  asyncTest("initialization with #AUTH_RETURN and add=false - trigger start with correct params", function() {
    winMock.location.hash = "#AUTH_RETURN";
    winMock.sessionStorage.primaryVerificationFlow = JSON.stringify({
      add: false,
      email: TESTEMAIL
    });

    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          equal(info.type, "primary", "correct type");
          equal(info.email, TESTEMAIL, "email_chosen with correct email");
          equal(info.add, false, "add is not specified with CREATE_EMAIL option");
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

  asyncTest("initialization with #AUTH_RETURN and add=true - trigger start with correct params", function() {
    winMock.location.hash = "#AUTH_RETURN";
    winMock.sessionStorage.primaryVerificationFlow = JSON.stringify({
      add: true,
      email: TESTEMAIL
    });

    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          equal(info.type, "primary", "correct type");
          equal(info.email, TESTEMAIL, "email_chosen with correct email");
          equal(info.add, true, "add is specified with ADD_EMAIL option");
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


  asyncTest("get with relative termsOfService & valid privacyPolicy - print error screen", function() {
    testRelativeURLNotAllowed({
      termsOfService: "relative.html",
      privacyPolicy: "/privacy.html"
    }, "relative.html");
  });

  asyncTest("get with script containing termsOfService - print error screen", function() {
    var URL = "relative.html<script>window.scriptRun=true;</script>";
    testRelativeURLNotAllowed({
      termsOfService: URL,
      privacyPolicy: "/privacy.html"
    }, URL);
  });

  asyncTest("get with valid termsOfService & relative privacyPolicy - print error screen", function() {
    var URL = "relative.html";
    testRelativeURLNotAllowed({
      termsOfService: "/tos.html",
      privacyPolicy: URL
    }, URL);
  });

  asyncTest("get with valid termsOfService & privacyPolicy='/' - print error screen", function() {
    var URL = "/";
    testRelativeURLNotAllowed({
      termsOfService: "/tos.html",
      privacyPolicy: URL
    }, URL);
  });

  asyncTest("get with valid termsOfService='/' and valid privacyPolicy - print error screen", function() {
    var URL = "/";
    testRelativeURLNotAllowed({
      termsOfService: URL,
      privacyPolicy: "/privacy.html"
    }, URL);
  });

  asyncTest("get with script containing privacyPolicy - print error screen", function() {
    var URL = "relative.html<script>window.scriptRun=true;</script>";
    testRelativeURLNotAllowed({
      termsOfService: "/tos.html",
      privacyPolicy: URL
    }, URL);
  });

  asyncTest("get with javascript protocol for privacyPolicy - print error screen", function() {
    var URL = "javascript:alert(1)";
    testRelativeURLNotAllowed({
      termsOfService: "/tos.html",
      privacyPolicy: URL
    }, URL);
  });

  asyncTest("get with invalid httpg protocol for privacyPolicy - print error screen", function() {
    var URL = "httpg://testdomain.com/privacy.html";
    testRelativeURLNotAllowed({
      termsOfService: "/tos.html",
      privacyPolicy: URL
    }, URL);
  });


  asyncTest("get with valid absolute termsOfService & privacyPolicy - go to start", function() {
    testExpectGetSuccess({
      termsOfService: "/tos.html",
      privacyPolicy: "/privacy.html"
    },
    {
      termsOfService: HTTPS_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTPS_TEST_DOMAIN + "/privacy.html"
    });
  });

  asyncTest("get with valid fully qualified http termsOfService & privacyPolicy - go to start", function() {
    testExpectGetSuccess({
      termsOfService: HTTP_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTP_TEST_DOMAIN + "/privacy.html"
    },
    {
      termsOfService: HTTP_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTP_TEST_DOMAIN + "/privacy.html"
    });
  });


  asyncTest("get with valid fully qualified https termsOfService & privacyPolicy - go to start", function() {
    testExpectGetSuccess({
      termsOfService: HTTPS_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTPS_TEST_DOMAIN + "/privacy.html"
    },
    {
      termsOfService: HTTPS_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTPS_TEST_DOMAIN + "/privacy.html"
    });
  });

  asyncTest("get with valid termsOfService, tosURL & privacyPolicy, privacyURL - use termsOfService and privacyPolicy", function() {
    testExpectGetSuccess({
      termsOfService: "/tos.html",
      tosURL: "/tos_deprecated.html",
      privacyPolicy: "/privacy.html",
      privacyURL: "/privacy_deprecated.html"
    },
    {
      termsOfService: HTTPS_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTPS_TEST_DOMAIN + "/privacy.html"
    });
  });

  asyncTest("get with relative siteLogo - not allowed", function() {
    var URL = "logo.png";
    testMustBeAbsolutePath({ siteLogo: URL }, URL);
  });

  asyncTest("get with javascript: siteLogo - not allowed", function() {
    var URL = "javascript:alert('xss')";
    testMustBeAbsolutePath({ siteLogo: URL }, URL);
  });

  asyncTest("get with data-uri: siteLogo - not allowed", function() {
    var URL = "data:image/png,FAKEDATA";
    testMustBeAbsolutePath({ siteLogo: URL }, URL);
  });

  asyncTest("get with http: siteLogo - not allowed", function() {
    var URL = HTTP_TEST_DOMAIN + "://logo.png";
    testMustBeAbsolutePath({ siteLogo: URL }, URL);
  });

  asyncTest("get with https: siteLogo - not allowed", function() {
    var URL = HTTPS_TEST_DOMAIN + "://logo.png";
    testMustBeAbsolutePath({ siteLogo: URL }, URL);
  });

  asyncTest("get with absolute path and http RP - not allowed", function() {
    var siteLogo = '/i/card.png';
    testExpectGetFailure({ siteLogo: siteLogo }, "only https sites can specify a siteLogo", HTTP_TEST_DOMAIN);
  });

  asyncTest("get with absolute path that is too long - not allowed", function() {
    var siteLogo = '/' + testHelpers.generateString(bid.PATH_MAX_LENGTH);
    testExpectGetFailure({ siteLogo: siteLogo }, "path portion of a url must be < " + bid.PATH_MAX_LENGTH + " characters");
  });

  asyncTest("get with absolute path causing too long of a URL - not allowed", function() {
    var shortHTTPSDomain = "https://test.com";
    // create a URL that is one character too long
    var siteLogo = '/' + testHelpers.generateString(bid.URL_MAX_LENGTH - shortHTTPSDomain.length);
    testExpectGetFailure({ siteLogo: siteLogo }, "urls must be < " + bid.URL_MAX_LENGTH + " characters");
  });

  asyncTest("get with absolute path and https RP - allowed URL but is properly escaped", function() {
    createController({
      ready: function() {
        var startInfo;
        mediator.subscribe("start", function(msg, info) {
          startInfo = info;
        });

        var siteLogo = '/i/card.png" onerror="alert(\'xss\')" <script>alert(\'more xss\')</script>';
        var retval = controller.get(HTTPS_TEST_DOMAIN, {
          siteLogo: siteLogo
        });

        testHelpers.testObjectValuesEqual(startInfo, {
          siteLogo: encodeURI(HTTPS_TEST_DOMAIN + siteLogo)
        });
        equal(typeof retval, "undefined", "no error expected");
        testErrorNotVisible();
        start();
      }
    });
  });

  asyncTest("get with a scheme-relative siteLogo URL - not allowed", function() {
    var URL = "//example.com/image.png";
    testMustBeAbsolutePath({ siteLogo: URL }, URL);
  });

  asyncTest("get with siteLogo='/' URL - not allowed", function() {
    testMustBeAbsolutePath({ siteLogo: "/" }, "/");
  });

  asyncTest("get with fully qualified returnTo - not allowed", function() {
    var URL = HTTPS_TEST_DOMAIN + "/path";
    testMustBeAbsolutePath({ returnTo: URL }, URL);
  });

  asyncTest("get with a scheme-relative returnTo URL - not allowed", function() {
    var URL = '//example.com/return';
    testMustBeAbsolutePath({ returnTo: URL }, URL);
  });

  asyncTest("get with absolute path returnTo - allowed", function() {
    testExpectGetSuccess({ returnTo: "/path"}, {}, undefined, function() {
      equal(user.getReturnTo(),
        HTTPS_TEST_DOMAIN + "/path", "returnTo correctly set");
    });
  });

  asyncTest("get with returnTo='/' - allowed", function() {
    testExpectGetSuccess({ returnTo: "/"}, {}, undefined, function() {
      equal(user.getReturnTo(),
        HTTPS_TEST_DOMAIN + "/", "returnTo correctly set");
    });
  });

  asyncTest("get with valid rp_api - allowed", function() {
    createController({
      ready: function() {
        mediator.subscribe("kpi_data", function(msg, info) {
          equal(info.rp_api, "get");
          start();
        });

        controller.get(HTTPS_TEST_DOMAIN, {
          rp_api: "get"
        });
      }
    });
  });

  asyncTest("get with invalid rp_api - not allowed", function() {
    testExpectGetFailure({
      rp_api: "invalid_value"
    }, "invalid value for rp_api: invalid_value");
  });

  asyncTest("get with invalid start_time - not allowed", function() {
    testExpectGetFailure({
      start_time: "invalid_value"
    }, "invalid value for start_time: invalid_value");
  });

  asyncTest("get with numeric start_time, the numeric value of the specified date as the number of milliseconds since January 1, 1970, 00:00:00 UTC - allowed", function() {
    var now = new Date().getTime();

    createController({
      ready: function() {
        mediator.subscribe("start_time", function(msg, info) {
          equal(info, now, "correct time passed");
          start();
        });

        controller.get(HTTPS_TEST_DOMAIN, {
          start_time: now.toString()
        });
      }
    });
  });

}());

