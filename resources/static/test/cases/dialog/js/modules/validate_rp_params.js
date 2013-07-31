/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";
  var controller,
      bid = BrowserID,
      testHelpers = bid.TestHelpers,
      testErrorVisible = testHelpers.testErrorVisible,
      testErrorNotVisible = testHelpers.testErrorNotVisible,
      HTTP_TEST_DOMAIN = "http://testdomain.org",
      HTTPS_TEST_DOMAIN = "https://testdomain.org",
      TESTEMAIL = "testuser@testuser.com",
      winMock;


  function WinMock() {
    this.location = {
      hash: "#1234"
    };

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

    this.navigator = {};
  }


  module("dialog/js/modules/validate_rp_params", {
    setup: function() {
      winMock = new WinMock();
      testHelpers.setup();
    },
    teardown: function() {
      if (controller) controller.destroy();
      testHelpers.teardown();
    }
  });


  function createController(config) {
    // startExternalDependencies defaults to true, for most of our tests we
    // want to turn this off to prevent the state machine, channel, and actions
    // controller from starting up and throwing errors.  This allows us to test
    // dialog as an individual unit.
    var options = $.extend({
      window: winMock
    }, config);

    controller = BrowserID.Modules.ValidateRpParams.create();
    controller.start(options);
  }

  function testExpectValidationFailure(options, expectedErrorMessage, domain) {
    _.extend(options, {
      ready: function() {
        options.originURL = domain || HTTPS_TEST_DOMAIN;
        try {
          controller.validate(options);
          ok(false);
        } catch(error) {
          if (expectedErrorMessage)
            equal(error.message, expectedErrorMessage, "expected error: " + expectedErrorMessage);

        }

        // If a parameter is not properly escaped, scriptRun will be true.
        equal(typeof window.scriptRun, "undefined", "script was not run");

        start();
      }
    });
    createController(options);
  }

  function testRelativeURLNotAllowed(options, path) {
    testExpectValidationFailure(options, "relative urls not allowed: (" + path + ")");
  }

  function testMustBeAbsolutePath(options, path) {
    testExpectValidationFailure(options, "must be an absolute path: (" + path + ")");
  }

  function testExpectValidationSuccess(options, expected, domain, done) {
    createController({
      ready: function() {
        var startInfo;
        options.originURL = domain || HTTPS_TEST_DOMAIN;

        try {
          startInfo = controller.validate(options);
        } catch(e) {
          equal(false);
        }

        testHelpers.testObjectValuesEqual(startInfo, expected);

        testErrorNotVisible();

        done && done();

        start();
      }
    });
  }



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
    testExpectValidationSuccess({
      termsOfService: "/tos.html",
      privacyPolicy: "/privacy.html"
    },
    {
      termsOfService: HTTPS_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTPS_TEST_DOMAIN + "/privacy.html"
    });
  });

  asyncTest("get with valid fully qualified http termsOfService & privacyPolicy - go to start", function() {
    testExpectValidationSuccess({
      termsOfService: HTTP_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTP_TEST_DOMAIN + "/privacy.html"
    },
    {
      termsOfService: HTTP_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTP_TEST_DOMAIN + "/privacy.html"
    });
  });


  asyncTest("get with valid fully qualified https termsOfService & privacyPolicy - go to start", function() {
    testExpectValidationSuccess({
      termsOfService: HTTPS_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTPS_TEST_DOMAIN + "/privacy.html"
    },
    {
      termsOfService: HTTPS_TEST_DOMAIN + "/tos.html",
      privacyPolicy: HTTPS_TEST_DOMAIN + "/privacy.html"
    });
  });

  asyncTest("get with valid termsOfService, tosURL & privacyPolicy, privacyURL - use termsOfService and privacyPolicy", function() {
    testExpectValidationSuccess({
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
    testExpectValidationFailure({siteLogo: URL});
  });

  asyncTest("get with javascript: siteLogo - not allowed", function() {
    var URL = "javascript:alert('xss')";
    testExpectValidationFailure({siteLogo: URL});
  });

  asyncTest("get with data:image/<whitelist>;... siteLogo - allowed", function() {
    testExpectValidationSuccess({
        siteLogo: "data:image/png;base64,FAKEDATA"
      },
      {
        siteLogo: "data:image/png;base64,FAKEDATA"
      }
    );
  });

  asyncTest("get with data:<not image>... siteLogo - not allowed", function() {
    var URL = "data:text/html;base64,FAKEDATA";
    testExpectValidationFailure({siteLogo: URL});
  });

  asyncTest("get with http: siteLogo - not allowed", function() {
    var URL = HTTP_TEST_DOMAIN + "/logo.png";
    testExpectValidationFailure({siteLogo: URL});
  });

  asyncTest("get with local https: siteLogo - allowed", function() {
    var siteLogo = HTTPS_TEST_DOMAIN + "/logo.png";
    testExpectValidationSuccess({
        siteLogo: siteLogo
      },
      {
        siteLogo: siteLogo
      });
  });

  asyncTest("get with arbitrary domain https: siteLogo - allowed", function() {
    var siteLogo = 'https://cdn.example.com/logo.png';
    testExpectValidationSuccess({
      siteLogo: siteLogo
      },
      {
        siteLogo: siteLogo
      });
  });

  asyncTest("get with absolute path and http RP - not allowed", function() {
    var siteLogo = '/i/card.png';
    testExpectValidationFailure({ siteLogo: siteLogo }, "siteLogos can only be served from https and data schemes.", HTTP_TEST_DOMAIN);
  });

  asyncTest("get with absolute path that is too long - not allowed", function() {
    var siteLogo = '/' + testHelpers.generateString(bid.PATH_MAX_LENGTH);
    testExpectValidationFailure({ siteLogo: siteLogo }, "path portion of a url must be < " + bid.PATH_MAX_LENGTH + " characters");
  });

  asyncTest("get with absolute path causing too long of a URL - not allowed", function() {
    var shortHTTPSDomain = "https://test.com";
    // create a URL that is one character too long
    var siteLogo = '/' + testHelpers.generateString(bid.URL_MAX_LENGTH - shortHTTPSDomain.length);
    testExpectValidationFailure({ siteLogo: siteLogo }, "urls must be < " + bid.URL_MAX_LENGTH + " characters");
  });

  asyncTest("get with absolute path and https RP - allowed URL but is properly escaped", function() {
    var siteLogo = '/i/card.png" onerror="alert(\'xss\')" <script>alert(\'more xss\')</script>';
    testExpectValidationSuccess({
        siteLogo: siteLogo
      },
      {
        siteLogo: encodeURI(HTTPS_TEST_DOMAIN + siteLogo)
      });
  });

  asyncTest("get with a scheme-relative siteLogo URL and https RP - allowed", function() {
    testExpectValidationSuccess({
        siteLogo: "//example.com/image.png"
      },
      {
        siteLogo: "https://example.com/image.png"
      });
  });

  // This sort of seems like a worthy test case
  asyncTest("get with siteLogo='/' URL - not allowed", function() {
    testExpectValidationFailure({ siteLogo: "/" });
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
    testExpectValidationSuccess({
      returnTo: "/path"
    }, {
      returnTo: HTTPS_TEST_DOMAIN + "/path"
    });
  });

  asyncTest("get with returnTo='/' - allowed", function() {
    testExpectValidationSuccess({
      returnTo: "/"
    }, {
      returnTo: HTTPS_TEST_DOMAIN + "/"
    });
  });

  asyncTest("experimental_forceAuthentication", function() {
    testExpectValidationSuccess(
      {experimental_forceAuthentication: true},
      {forceAuthentication: true}
    );
  });

  asyncTest("experimental_forceAuthentication invalid", function() {
    testExpectValidationFailure(
      {experimental_forceAuthentication: "true"});
  });

  asyncTest("get with valid issuer - allowed", function() {
    var issuer = "fxos.persona.org";
    testExpectValidationSuccess(
      { experimental_forceIssuer: issuer },
      { forceIssuer: issuer }
    );
  });

  asyncTest("get with non hostname issuer - bzzzt", function() {
    var issuer = "https://issuer.must.be.a.hostname";
    testExpectValidationFailure({ experimental_forceIssuer: issuer });
  });

  asyncTest("experimental_allowUnverified", function() {
    testExpectValidationSuccess(
      {experimental_allowUnverified: true},
      {allowUnverified: true}
    );
  });

  asyncTest("experimental_allowUnverified invalid", function() {
    testExpectValidationFailure(
      {experimental_allowUnverified: "true"});
  });

  asyncTest("get with valid rp_api - allowed", function() {
    createController({
      ready: function() {
        testExpectValidationSuccess({
          rp_api: "get"
        }, {
          rpAPI: "get"
        });
      }
    });
  });

  asyncTest("get with invalid rp_api - not allowed", function() {
    testExpectValidationFailure({
      rp_api: "invalid_value"
    }, "invalid value for rp_api: invalid_value");
  });

  asyncTest("get with invalid start_time - not allowed", function() {
    testExpectValidationFailure({
      start_time: "invalid_value"
    }, "invalid value for start_time: invalid_value");
  });

  asyncTest("get with numeric start_time, the numeric value of the specified date as the number of milliseconds since January 1, 1970, 00:00:00 UTC - allowed", function() {
    var now = new Date().getTime();

    createController({
      ready: function() {
        testExpectValidationSuccess({
          start_time: now.toString()
        }, {
          startTime: now
        });
      }
    });
  });

  asyncTest("invalid backgroundColor - not allowed", function() {
    testExpectValidationFailure({
      backgroundColor: "invalid_value"
    }, "invalid backgroundColor: invalid_value");
  });

  asyncTest("incorrect length (2) backgroundColor - not allowed", function() {
    testExpectValidationFailure({
      backgroundColor: "ab"
    }, "invalid backgroundColor: ab");
  });

  asyncTest("incorrect length (4) backgroundColor - not allowed", function() {
    testExpectValidationFailure({
      backgroundColor: "abcd"
    }, "invalid backgroundColor: abcd");
  });

  asyncTest("incorrect length (5) backgroundColor - not allowed", function() {
    testExpectValidationFailure({
      backgroundColor: "abcde"
    }, "invalid backgroundColor: abcde");
  });

  asyncTest("incorrect length (7) backgroundColor - not allowed", function() {
    testExpectValidationFailure({
      backgroundColor: "abcdeff"
    }, "invalid backgroundColor: abcdeff");
  });

  asyncTest("valid 3 char backgroundColor - allowed & normalized", function() {
    testExpectValidationSuccess({backgroundColor: "abc"},
                         {backgroundColor: "aabbcc"});
  });

  asyncTest("valid 3 char backgroundColor with hash - allowed & normalized",
      function() {
    testExpectValidationSuccess({backgroundColor: "#123"},
                         {backgroundColor: "112233"});
  });

  asyncTest("valid 6 char backgroundColor - allowed", function() {
    testExpectValidationSuccess({backgroundColor: "abcdef"},
                         {backgroundColor: "abcdef"});
  });

  asyncTest("valid 6 char backgroundColor with hash - allowed", function() {
    testExpectValidationSuccess({backgroundColor: "#456DEF"},
                         {backgroundColor: "456DEF"});
  });


}());
