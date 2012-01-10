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
      network = bid.Network,
      user = bid.User,
      xhr = bid.Mocks.xhr,
      WinChanMock = bid.Mocks.WinChan,
      provisioning = bid.Mocks.Provisioning,
      testHelpers = bid.TestHelpers,
      docMock = {
        location: "signin"
      },
      controller,
      winchan;

  module("pages/signin", {
    setup: function() {
      testHelpers.setup();
      docMock.location = "signin";
      bid.Renderer.render("#page_head", "site/signin", {});
      winchan = new WinChanMock();
      controller = bid.signIn.create();
      controller.start({document: docMock, winchan: winchan});
    },
    teardown: function() {
      testHelpers.teardown();
      if(controller) controller.destroy();
    }
  });

  function testUserNotSignedIn(extraTests) {
    controller.passwordSubmit(function() {
      equal(docMock.location, "signin", "user not signed in");
      if (extraTests) extraTests();
      start();
    });
  }

  asyncTest("emailSubmit with invalid email - show tooltip", function() {
    controller.emailSubmit(function() {
      testHelpers.testTooltipVisible();
      start();
    });
  });

  asyncTest("address with XHR error - show error screen", function() {
    xhr.useResult("xhrError");
    $("#email").val("unregistered@testuser.com");

    controller.emailSubmit(function() {
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("unknown_secondary: emailSubmit - add unknown_secondary to body", function() {
    xhr.useResult("unknown_secondary");
    $("#email").val("unregistered@testuser.com");

    controller.emailSubmit(function() {
      equal($("body").hasClass("unknown_secondary"), true, "unknown_secondary class added to body");
      equal(controller.submit, controller.emailSubmit, "submit remains emailSubmit");
      start();
    });
  });

  asyncTest("known_secondary: emailSubmit - known_secondary added to body", function() {
    xhr.useResult("known_secondary");
    $("#email").val("registered@testuser.com");

    controller.emailSubmit(function() {
      equal($("body").hasClass("known_secondary"), true, "known_secondary class added to body");
      equal(controller.submit, controller.passwordSubmit, "submit has changed to passwordSubmit");
      start();
    });
  });

  asyncTest("primary, authenticated with IdP: emailSubmit - user immediately signed in", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.AUTHENTICATED);
    $("#email").val("registered@testuser.com");

    controller.emailSubmit(function() {
      network.checkAuth(function(status) {
        equal(status, "assertion", "user is authenticated with an assertion");
        equal(docMock.location, "/", "user signed in, page redirected");
        start();
      }, testHelpers.unexpectedFailure);
    });
  });

  asyncTest("primary, not authenticated with IdP: emailSubmit - sign in to IdP shown", function() {
    xhr.useResult("primary");
    provisioning.setStatus(provisioning.NOT_AUTHENTICATED);
    $("#email").val("registered@testuser.com");

    controller.emailSubmit(function() {
      equal($("body").hasClass("verify_primary"), true, "verify_primary class added to body");
      equal(controller.submit, controller.authWithPrimary, "submit updated to authWithPrimary");
      start();
    });
  });

  asyncTest("passwordSubmit with valid email and password", function() {
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    controller.passwordSubmit(function() {
      equal(docMock.location, "/", "user signed in, page redirected");
      start();
    });
  });

  asyncTest("passwordSubmit with valid email with leading/trailing whitespace and password", function() {
    $("#email").val("  registered@testuser.com  ");
    $("#password").val("password");

    controller.passwordSubmit(function() {
      equal(docMock.location, "/", "user signed in, page redirected");
      start();
    });
  });

  asyncTest("passwordSubmit with missing email", function() {
    $("#email").val("");
    $("#password").val("password");

    testUserNotSignedIn();
  });

  asyncTest("passwordSubmit with missing password", function() {
    $("#email").val("registered@testuser.com");
    $("#password").val("");

    testUserNotSignedIn();
  });


  asyncTest("passwordSubmit with bad username/password", function() {
    xhr.useResult("invalid");
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    testUserNotSignedIn();
  });

  asyncTest("passwordSubmit with XHR error", function() {
    xhr.useResult("ajaxError");
    $("#email").val("registered@testuser.com");
    $("#password").val("password");

    testUserNotSignedIn(function() {
        equal($("#error").is(":visible"), true, "error is visible");
    });
  });

  asyncTest("authWithPrimary opens winchan", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    controller.emailSubmit(function(status) {
      controller.authWithPrimary(function() {
        ok(winchan.oncomplete, "winchan set up");
        start();
      });
    });
  });

  asyncTest("primaryAuthComplete logs user in", function() {
    xhr.useResult("primary");
    $("#email").val("unregistered@testuser.com");

    controller.emailSubmit(function() {
      controller.authWithPrimary(function() {
        provisioning.setStatus(provisioning.AUTHENTICATED);

        controller.primaryAuthComplete(null, "yar", function() {
          network.checkAuth(function(status) {
            equal(status, "assertion", "user is authenticated with an assertion");
            equal(docMock.location, "/", "user signed in, page redirected");
            start();
          }, testHelpers.unexpectedFailure);
        });
      });
    });
  });


}());
