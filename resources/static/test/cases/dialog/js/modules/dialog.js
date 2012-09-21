/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
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
      startExternalDependencies: false,
    }, config);

    controller = BrowserID.Modules.Dialog.create();
    controller.start(options);
  }

  function testMessageNotExpected(msg) {
    mediator.subscribe(msg, function(msg, info) {
      ok(false, "unexpected message: " + msg);
    });
  }

  function testExpectGetFailure(options, expectedErrorMessage) {
    _.extend(options, {
      ready: function() {
        testMessageNotExpected("kpi_data");
        testMessageNotExpected("start");

        var retval = controller.get(HTTPS_TEST_DOMAIN, options);

        if (expectedErrorMessage) {
          equal(retval, expectedErrorMessage, "expected error: " + expectedErrorMessage);
        }
        else {
          ok(retval, "error message returned");
        }

        testErrorVisible();
        start();
      }
    });
    createController(options);
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
          registerControllerCalled = controller.getVerifiedEmail && controller.get;
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
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          termsOfService: "relative.html",
          privacyPolicy: "/privacy.html"
        });
        equal(retval, "relative urls not allowed: (relative.html)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with script containing termsOfService - print error screen", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          termsOfService: "relative.html<script>window.scriptRun=true;</script>",
          privacyPolicy: "/privacy.html"
        });

        // If termsOfService is not properly escaped, scriptRun will be true.
        equal(typeof window.scriptRun, "undefined", "script was not run");
        equal(retval, "relative urls not allowed: (relative.html<script>window.scriptRun=true;</script>)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with valid termsOfService & relative privacyPolicy - print error screen", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          termsOfService: "/tos.html",
          privacyPolicy: "relative.html"
        });
        equal(retval, "relative urls not allowed: (relative.html)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with script containing privacyPolicy - print error screen", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          termsOfService: "/tos.html",
          privacyPolicy: "relative.html<script>window.scriptRun=true;</script>"
        });

        // If privacyPolicy is not properly escaped, scriptRun will be true.
        equal(typeof window.scriptRun, "undefined", "script was not run");
        equal(retval, "relative urls not allowed: (relative.html<script>window.scriptRun=true;</script>)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with privacyPolicy - print error screen", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          termsOfService: "/tos.html",
          privacyPolicy: "relative.html<script>window.scriptRun=true;</script>"
        });

        // If privacyPolicy is not properly escaped, scriptRun will be true.
        equal(typeof window.scriptRun, "undefined", "script was not run");
        equal(retval, "relative urls not allowed: (relative.html<script>window.scriptRun=true;</script>)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with javascript protocol for privacyPolicy - print error screen", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          termsOfService: "/tos.html",
          privacyPolicy: "javascript:alert(1)"
        });

        equal(retval, "relative urls not allowed: (javascript:alert(1))", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with invalid httpg protocol for privacyPolicy - print error screen", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          termsOfService: "/tos.html",
          privacyPolicy: "httpg://testdomain.com/privacy.html"
        });

        equal(retval, "relative urls not allowed: (httpg://testdomain.com/privacy.html)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });


  function testValidTermsOfServicePrivacyPolicy(options, expected) {
    createController({
      ready: function() {
        var startInfo;
        mediator.subscribe("start", function(msg, info) {
          startInfo = info;
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, options);
        testHelpers.testObjectValuesEqual(startInfo, expected);

        equal(typeof retval, "undefined", "no error expected");
        testErrorNotVisible();
        start();
      }
    });
  }

  asyncTest("get with valid absolute termsOfService & privacyPolicy - go to start", function() {
    testValidTermsOfServicePrivacyPolicy({
      termsOfService: "/tos.html",
      privacyPolicy: "/privacy.html"
    },
    {
      termsOfService: HTTP_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTP_TEST_DOMAIN + "/privacy.html"
    });
  });

  asyncTest("get with valid fully qualified http termsOfService & privacyPolicy - go to start", function() {
    testValidTermsOfServicePrivacyPolicy({
      termsOfService: HTTP_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTP_TEST_DOMAIN + "/privacy.html"
    },
    {
      termsOfService: HTTP_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTP_TEST_DOMAIN + "/privacy.html"
    });
  });


  asyncTest("get with valid fully qualified https termsOfService & privacyPolicy - go to start", function() {
    testValidTermsOfServicePrivacyPolicy({
      termsOfService: HTTPS_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTPS_TEST_DOMAIN + "/privacy.html"
    },
    {
      termsOfService: HTTPS_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTPS_TEST_DOMAIN + "/privacy.html"
    });
  });

  asyncTest("get with valid termsOfService, tosURL & privacyPolicy, privacyURL - use termsOfService and privacyPolicy", function() {
    testValidTermsOfServicePrivacyPolicy({
      termsOfService: "/tos.html",
      tosURL: "/tos_deprecated.html",
      privacyPolicy: "/privacy.html",
      privacyURL: "/privacy_deprecated.html"
    },
    {
      termsOfService: HTTP_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTP_TEST_DOMAIN + "/privacy.html"
    });
  });

  asyncTest("get with relative siteLogo - not allowed", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          siteLogo: "logo.png",
        });

        equal(retval, "must be an absolute path: (logo.png)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with javascript: siteLogo - not allowed", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          siteLogo: "javascript:alert('xss')",
        });

        equal(retval, "must be an absolute path: (javascript:alert('xss'))", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with data-uri: siteLogo - not allowed", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          siteLogo: "data:image/png,FAKEDATA",
        });

        equal(retval, "must be an absolute path: (data:image/png,FAKEDATA)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with http: siteLogo - not allowed", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          siteLogo: HTTP_TEST_DOMAIN + "://logo.png",
        });

        equal(retval, "must be an absolute path: (" + HTTP_TEST_DOMAIN + "://logo.png)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with https: siteLogo - not allowed", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          siteLogo: HTTPS_TEST_DOMAIN + "://logo.png",
        });

        equal(retval, "must be an absolute path: (" + HTTPS_TEST_DOMAIN + "://logo.png)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with absolute path and http RP - not allowed", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var siteLogo = '/i/card.png';
        var retval = controller.get(HTTP_TEST_DOMAIN, {
          siteLogo: siteLogo
        });

        equal(retval, "only https sites can specify a siteLogo", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with absolute path that is too long - not allowed", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        // create a logo path that is one character too long
        var siteLogo = '/' + testHelpers.generateString(bid.PATH_MAX_LENGTH);
        var retval = controller.get(HTTPS_TEST_DOMAIN, {
          siteLogo: siteLogo
        });

        equal(retval, "path portion of a url must be < " + bid.PATH_MAX_LENGTH + " characters");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with absolute path causing too long of a URL - not allowed", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var shortHTTPSDomain = "https://test.com";
        // create a URL that is one character too long
        var siteLogo = '/' + testHelpers.generateString(bid.URL_MAX_LENGTH - shortHTTPSDomain.length);
        var retval = controller.get(shortHTTPSDomain, {
          siteLogo: siteLogo
        });

        equal(retval, "urls must be < " + bid.URL_MAX_LENGTH + " characters");
        testErrorVisible();
        start();
      }
    });
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
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "start should not have been called");
        });

        var retval = controller.get(HTTPS_TEST_DOMAIN, {
          siteLogo: "//example.com/image.png"
        });

        equal(retval, "must be an absolute path: (//example.com/image.png)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with returnTo with https - not allowed", function() {
    createController({
      ready: function() {
        var URL = HTTP_TEST_DOMAIN + "/path";

        mediator.subscribe("start", function(msg, info) {
          ok(false, "unexpected start");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          returnTo: URL
        });

        equal(retval, "must be an absolute path: (" + URL + ")", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with a scheme-relative returnTo URL - not allowed", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          ok(false, "unexpected start");
        });

        var retval = controller.get(HTTP_TEST_DOMAIN, {
          returnTo: '//example.com/return'
        });

        equal(retval, "must be an absolute path: (//example.com/return)", "expected error");
        testErrorVisible();
        start();
      }
    });
  });

  asyncTest("get with absolute path returnTo - allowed", function() {
    createController({
      ready: function() {
        mediator.subscribe("start", function(msg, info) {
          equal(user.getReturnTo(), HTTPS_TEST_DOMAIN + "/path", "returnTo correctly set");
          start();
        });

        var retval = controller.get(HTTPS_TEST_DOMAIN, {
          returnTo: "/path"
        });
      }
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
}());

