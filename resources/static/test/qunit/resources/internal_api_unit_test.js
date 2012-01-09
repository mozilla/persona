/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID:true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
(function() {
  "use strict";

  var bid = BrowserID,
      internal = bid.internal,
      network = bid.Network,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      origin = "https://browserid.org",
      storage = bid.Storage,
      moduleManager = bid.module;

  function ModuleMock() {}

  ModuleMock.prototype = {
    init: function() {},
    start: function() {}
  };

  module("resources/internal_api", {
    setup: function() {
      network.setXHR(xhr);
      xhr.useResult("valid");
      xhr.setContextInfo("auth_level", undefined);
      storage.clear();
      moduleManager.reset();
      moduleManager.register("dialog", ModuleMock);
      moduleManager.start("dialog");
    },

    teardown: function() {
      network.setXHR($);
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
