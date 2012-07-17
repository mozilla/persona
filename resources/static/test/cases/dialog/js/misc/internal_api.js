/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
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
      origin = "https://login.persona.org",
      storage = bid.Storage,
      moduleManager = bid.module,
      testHelpers = bid.TestHelpers;

  function ModuleMock() {}

  ModuleMock.prototype = {
    init: function() {},
    start: function() {}
  };

  module("dialog/js/misc/internal_api", {
    setup: function() {
      testHelpers.setup();
      moduleManager.reset();
      moduleManager.register("dialog", ModuleMock);
      moduleManager.start("dialog");
    },

    teardown: function() {
      testHelpers.teardown();
    }
  });

  test("make sure internal api namespace is there", function() {
    ok(bid.internal, "BrowserID.internal exists");
  });

  asyncTest("BrowserID.internal.setPersistent unauthenticated user", function() {
    internal.setPersistent(origin, function(status) {
      strictEqual(status, null, "user is not authenticated should not succeed in setting persistent");

      strictEqual(typeof storage.site.get(origin, "remember"), "undefined", "remember status not set");
      strictEqual(typeof storage.site.get(origin, "email"), "undefined", "email not set");
      start();
    });
  });

  asyncTest("BrowserID.internal.setPersistent with authenticated user", function() {
    user.authenticate("testuser@testuser.com", "password", function() {
      internal.setPersistent(origin, function(status) {
        equal(status, true, "setPersistent status reported as true");

        equal(storage.site.get(origin, "remember"), true, "remember status set to true");
        start();
      });
    });
  });

  asyncTest("BrowserID.internal.get with silent: true, non-authenticated user - returns null assertion", function() {
    internal.get(origin, function(assertion) {
      strictEqual(assertion, null, "user not logged in, assertion impossible to get");
      start();
    }, {
        requiredEmail: "testuser@testuser.com",
        silent: true
    });
  });

  asyncTest("BrowserID.internal.get with silent: true, authenticated user, no requiredEmail, and no email address associated with site - not enough info to generate an assertion", function() {
    user.authenticate("testuser@testuser.com", "password", function() {
      internal.get(origin, function(assertion) {
        strictEqual(assertion, null, "not enough info to generate an assertion, assertion should not be generated");
        start();
      }, {
        silent: true
      });
    });
  });

  asyncTest("BrowserID.internal.get with silent: true, authenticated user, no requiredEmail, email address associated with site, XHR failure - return null assertion.", function() {
    user.authenticate("testuser@testuser.com", "password", function() {
      user.syncEmails(function() {
        storage.site.set(origin, "email", "testuser@testuser.com");

        xhr.useResult("invalid");

        internal.get(origin, function(assertion) {
          strictEqual(assertion, null, "XHR failure while getting assertion");
          start();
        }, {
          silent: true
        });
      });
    });
  });

  asyncTest("BrowserID.internal.get with silent: true, authenticated user, no requiredEmail, email address associated with site - use info stored for site to get assertion", function() {
    user.authenticate("testuser@testuser.com", "password", function() {
      user.syncEmails(function() {
        storage.site.set(origin, "email", "testuser@testuser.com");

        internal.get(origin, function(assertion) {
          ok(assertion, "assertion generated using stored email address for site.");
          start();
        }, {
          silent: true
        });
      });
    });
  });

  asyncTest("BrowserID.internal.get with silent: true, authenticated user, requiredEmail set to uncontrolled email address - return null assertion", function() {
    user.authenticate("testuser@testuser.com", "password", function() {
      // email addresses will not be synced just because we authenticated.
      // Depending on get to do the sync.
      internal.get(origin, function(assertion) {
        strictEqual(assertion, null, "uncontrolled email address returns null assertion");
        start();
      }, {
        silent: true,
        requiredEmail: "invalid@testuser.com"
      });
    });
  });

  asyncTest("BrowserID.internal.get with silent: true, authenticated user, requiredEmail and XHR error - return null assertion", function() {
    user.authenticate("testuser@testuser.com", "password", function() {
      xhr.useResult("invalid");
      internal.get(origin, function(assertion) {
        strictEqual(assertion, null, "unregistered email address returns null assertion");
        start();
      }, {
        silent: true,
        requiredEmail: "invalid@testuser.com"
      });
    });
  });

  asyncTest("BrowserID.internal.get with silent: true, authenticated user, requiredEmail, and registered email address - return an assertion", function() {
    user.authenticate("testuser@testuser.com", "password", function() {
      internal.get(origin, function(assertion) {
        ok(assertion, "assertion has been returned");
        start();
      }, {
        silent: true,
        requiredEmail: "testuser@testuser.com"
      });
    });
  });

  asyncTest("BrowserID.internal.get with dialog - simulate the user return of an assertion", function() {
    var controllerOrigin;

    ModuleMock.prototype.get = function(getOrigin, options, onsuccess, onerror) {
      controllerOrigin = getOrigin;
      // simulate the full dialog flow.
      onsuccess("simulated_assertion");
    };

    internal.get(origin, function onComplete(assertion) {
        equal(controllerOrigin, origin, "correct origin passed");
        equal(assertion, "simulated_assertion", "Kosher assertion");
        start();
    }, {});
  });

  asyncTest("BrowserID.internal.get with dialog with failure - simulate the return of a null assertion", function() {
    ModuleMock.prototype.get = function(getOrigin, options, onsuccess, onerror) {
      onerror();
    };

    internal.get(origin, function onComplete(assertion) {
        equal(assertion, null, "on failure, assertion is null");
        start();
    }, {});
  });

  asyncTest("BrowserID.internal.get with dialog with user cancellation - return null assertion", function() {
    ModuleMock.prototype.get = function(getOrigin, options, onsuccess, onerror) {
      onsuccess(null);
    };

    internal.get(origin, function onComplete(assertion) {
        equal(assertion, null, "on cancel, assertion is null");
        start();
    }, {});
  });
}());
