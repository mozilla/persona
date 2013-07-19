/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      internal = bid.internal,
      network = bid.Network,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      storage = bid.Storage,
      moduleManager = bid.module,
      testHelpers = bid.TestHelpers,
      testUndefined = testHelpers.testUndefined,
      testNotUndefined = testHelpers.testNotUndefined,
      ORIGIN = "https://login.persona.org",
      TEST_EMAIL = "testuser@testuser.com",
      TEST_PASSWORD = "password",
      dialogModule;

  function ModuleMock() {}

  ModuleMock.prototype = {
    init: function() {},
    start: function() {},
    get: function(getOrigin, options, onsuccess, onerror) {
      this.controllerOrigin = getOrigin;
      // simulate the full dialog flow.

      if (typeof this.get_success_value !== "undefined") onsuccess(this.get_success_value);
      else onerror();
    }
  };

  function suppressLog(msg) {
    // do nothing with the log message;
  }

  module("dialog/js/misc/internal_api", {
    setup: function() {
      testHelpers.setup();
      moduleManager.reset();
      moduleManager.register("dialog", ModuleMock);
      dialogModule = moduleManager.start("dialog");
    },

    teardown: function() {
      testHelpers.teardown();
    }
  });

  asyncTest("setPersistent unauthenticated user", function() {
    internal.setPersistent(ORIGIN, function(status) {
      strictEqual(status, null, "user is not authenticated should not succeed in setting persistent");

      testUndefined(storage.site.get(ORIGIN, "remember"), "remember status not set");
      testUndefined(storage.site.get(ORIGIN, "email"), "email not set");
      start();
    });
  });

  asyncTest("setPersistent with authenticated user", function() {
    user.authenticate(TEST_EMAIL, TEST_PASSWORD, function() {
      internal.setPersistent(ORIGIN, function(status) {
        equal(status, true, "setPersistent status reported as true");

        equal(storage.site.get(ORIGIN, "remember"), true, "remember status set to true");
        start();
      });
    });
  });

  asyncTest(".get with silent: true, authenticated user, and no email address associated with site - not enough info to generate an assertion", function() {
    user.authenticate(TEST_EMAIL, TEST_PASSWORD, function() {
      internal.get(ORIGIN, function(assertion) {
        strictEqual(assertion, null, "not enough info to generate an assertion, assertion should not be generated");
        start();
      }, {
        silent: true
      });
    });
  });

  asyncTest(".get with silent: true, authenticated user, email address associated with site, XHR failure - return null assertion.", function() {
    user.authenticate(TEST_EMAIL, TEST_PASSWORD, function() {
      user.syncEmails(function() {
        storage.site.set(ORIGIN, "logged_in", TEST_EMAIL);

        xhr.useResult("invalid");

        internal.get(ORIGIN, function(assertion) {
          strictEqual(assertion, null, "XHR failure while getting assertion");
          start();
        }, {
          silent: true
        });
      });
    });
  });

  asyncTest(".get with silent: true, authenticated user, email address associated with site - use info stored for site to get assertion", function() {
    user.authenticate(TEST_EMAIL, TEST_PASSWORD, function() {
      user.syncEmails(function() {
        storage.site.set(ORIGIN, "email", TEST_EMAIL);

        internal.get(ORIGIN, function(assertion) {
          ok(assertion, "assertion generated using stored email address for site.");
          start();
        }, {
          silent: true
        });
      });
    });
  });

  asyncTest(".get with dialog - simulate the user return of an assertion", function() {
    dialogModule.get_success_value = "simulated_assertion";

    internal.get(ORIGIN, function onComplete(assertion) {
        equal(dialogModule.controllerOrigin, ORIGIN, "correct origin passed");
        equal(assertion, "simulated_assertion", "Kosher assertion");
        start();
    }, {});
  });

  asyncTest(".get with valid string passed for options - all good", function() {
    dialogModule.get_success_value = "simulated_assertion";

    internal.get(ORIGIN, function onComplete(assertion) {
        equal(dialogModule.controllerOrigin, ORIGIN, "correct origin passed");
        equal(assertion, "simulated_assertion", "Kosher assertion");
        start();
    }, "{}");
  });

  test(".get with invalid string passed for options - assertion is not generated", function() {
    dialogModule.get_success_value = "simulated_assertion";

    internal.get(ORIGIN, function(assertion) {
      ok(false, "callback should not be called if invalid JSON is used");
    }, "{invalid_json:}", suppressLog);
  });

  asyncTest(".get with dialog with failure - simulate the return of a null assertion", function() {
    dialogModule.get_success_value = undefined;

    internal.get(ORIGIN, function onComplete(assertion) {
        equal(assertion, null, "on failure, assertion is null");
        start();
    }, {});
  });

  asyncTest(".get with dialog with user cancellation - return null assertion", function() {
    dialogModule.get_success_value = null;

    internal.get(ORIGIN, function onComplete(assertion) {
        equal(assertion, null, "on cancel, assertion is null");
        start();
    }, {});
  });

  asyncTest(".watch - authenticated user requests an assertion with saved issuer - assertion generated with cert for that issuer", function() {
    xhr.setContextInfo("auth_level", "password");
    xhr.setContextInfo("userid", 1);
    storage.addEmail(TEST_EMAIL);

    storage.site.set(ORIGIN, "logged_in", TEST_EMAIL);
    storage.site.set(ORIGIN, "email", TEST_EMAIL);
    storage.site.set(ORIGIN, "issuer", "fxos_issuer");

    internal.watch(function(resp) {
      if (resp.method === "login") {
        ok(resp.assertion);
      }
      else if (resp.method === "ready") {
        start();
      }
      else {
        ok(false, "unexpected method call: " + resp.method);
      }
    }, {
      origin: ORIGIN,
      loggedInUser: "testuser2@testuser.com"
    }, console.log);
  });



  asyncTest(".watch with invalid string passed for options - options.error is returned", function() {
    dialogModule.get_success_value = "simulated_assertion";

    internal.watch(function(options) {
      ok(options.error, "options.error in callback if invalid JSON is used");
      start();
    }, "{invalid_json:}", suppressLog);
  });

  asyncTest(".watch with authenticated user, no loggedInUser passed - assertion generated", function() {
    xhr.setContextInfo("auth_level", "password");
    xhr.setContextInfo("userid", 1);
    storage.addEmail(TEST_EMAIL);

    storage.site.set(ORIGIN, "logged_in", TEST_EMAIL);
    storage.site.set(ORIGIN, "email", TEST_EMAIL);
    var und;

    var count = 0;
    internal.watch(function(resp) {
      count++;
      // login should happen before ready
      if (resp.method === "login") {
        equal(count, 1);
        ok(resp.assertion);
      }
      else if (resp.method === "ready") {
        equal(count, 2);
        start();
      }
      else {
        ok(false, "unexpected method call: " + resp.method);
      }
    }, {
      origin: ORIGIN,
      loggedInUser: und
    });
  });

  asyncTest(".watch with authenticated user, loggedInUser passed - only call with ready method", function() {
    xhr.setContextInfo("auth_level", "password");
    xhr.setContextInfo("userid", 1);
    storage.addEmail(TEST_EMAIL);

    storage.site.set(ORIGIN, "logged_in", TEST_EMAIL);
    storage.site.set(ORIGIN, "email", TEST_EMAIL);
    var und;

    var count = 0;
    internal.watch(function(resp) {
      count++;
      if (resp.method === "ready") {
        equal(count, 1);
        start();
      }
      else {
        ok(false, "unexpected method call: " + resp.method);
      }
    }, {
      origin: ORIGIN,
      loggedInUser: TEST_EMAIL
    });
  });

  asyncTest(".watch with authenticated user, different loggedInUser passed - call logout on old user, then ready", function() {
    user.authenticate(TEST_EMAIL, TEST_PASSWORD, function() {
      storage.addEmail("testuser2@testuser.com", {});
      storage.site.set(ORIGIN, "logged_in", "testuser2@testuser.com");
      storage.site.set(ORIGIN, "email", "testuser2@testuser.com");
      var und;

      var count = 0;
      internal.watch(function(resp) {
        count++;
        if (resp.method === "logout") {
          equal(count, 1);
        }
        else if (resp.method === "ready") {
          equal(count, 2);
          start();
        }
        else {
          ok(false, "unexpected method call: " + resp.method);
        }
      }, {
        origin: ORIGIN,
        loggedInUser: TEST_EMAIL
      });
    });
  });

  asyncTest("logout of authenticated user logs the user out of origin", function() {
    user.authenticate(TEST_EMAIL, TEST_PASSWORD, function() {
      // simulate multiple origin->email associations.
      storage.site.set(ORIGIN, "logged_in", TEST_EMAIL);
      storage.site.set(ORIGIN + "2", "logged_in", TEST_EMAIL);

      internal.logout(ORIGIN, function(success) {
        equal(success, true, "user has been successfully logged out");

        // with logout, only the association specified for the origin is
        // cleared.
        testUndefined(storage.site.get(ORIGIN, "logged_in"));
        testNotUndefined(storage.site.get(ORIGIN + "2", "logged_in"));

        start();
      });
    });
  });

  asyncTest("logout of non-authenticated user does nothing", function() {
    internal.logout(ORIGIN, function(success) {
      equal(success, false, "user was not logged in so cannot be logged out");
      start();
    });
  });

  asyncTest("logoutEverywhere of authenticated user logs the user out everywhere", function() {
    user.authenticate(TEST_EMAIL, TEST_PASSWORD, function() {
      // simulate multiple origin->email associations.
      storage.site.set(ORIGIN, "logged_in", TEST_EMAIL);
      storage.site.set(ORIGIN + "2", "logged_in", TEST_EMAIL);

      internal.logoutEverywhere(function(success) {
        equal(success, true, "user has been successfully logged out everywhere");
        // with logoutEverywhere, both associations should be cleared.
        testUndefined(storage.site.get(ORIGIN, "logged_in"));
        testUndefined(storage.site.get(ORIGIN + "2", "logged_in"));

        start();
      });
    })

  });

  asyncTest("logoutEverywhere of non-authenticated user does nothing", function() {
    internal.logoutEverywhere(function(success) {
      equal(success, false, "user was not logged in so cannot be logged out");
      start();
    });
  });

}());
