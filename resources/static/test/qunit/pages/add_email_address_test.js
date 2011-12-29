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
      storage = bid.Storage,
      xhr = bid.Mocks.xhr,
      dom = bid.DOM,
      testHelpers = bid.TestHelpers,
      validToken = true,
      controller,
      config = {
        token: "token"
      };

  module("pages/add_email_address", {
    setup: function() {
      testHelpers.setup();
      bid.Renderer.render("#page_head", "site/add_email_address", {});
      $(".siteinfo,.password_entry").hide();
    },
    teardown: function() {
      testHelpers.teardown();
      $("#page_head").empty();
    }
  });

  function createPrimaryUser() {
    storage.addEmail("testuser@testuser.com", {
      created: new Date(),
      type: "primary"
    });
  }

  function createController(options, callback) {
    controller = BrowserID.addEmailAddress.create();
    options = options || {};
    options.ready = callback;
    controller.start(options);
  }

  function expectTooltipVisible() {
    createPrimaryUser();
    createController(config, function() {
      controller.submit(function() {
        testHelpers.testTooltipVisible();
        start();
      });
    });
  }

  function testEmail() {
    equal(dom.getInner(".email"), "testuser@testuser.com", "correct email shown");
  }

  function testCannotConfirm() {
    ok($("#cannotconfirm").is(":visible"), "cannot confirm box is visible");
  }

  test("start with missing token", function() {
    var error;
    try {
      createController({});
    } catch(e) {
      error = e;
    }

    equal(error, "missing config option: token", "correct error thrown");
  });

  asyncTest("no password: start with good token and site", function() {
    storage.setStagedOnBehalfOf("browserid.org");

    createController(config, function() {
      testEmail();
      ok($(".siteinfo").is(":visible"), "siteinfo is visible when we say what it is");
      equal($(".website:nth(0)").text(), "browserid.org", "origin is updated");
      equal($("body").hasClass("complete"), true, "body has complete class");
      start();
    });
  });

  asyncTest("no password: start with good token and nosite", function() {
    createController(config, function() {
      testEmail();
      equal($(".siteinfo").is(":visible"), false, "siteinfo is not visible without having it");
      equal($(".siteinfo .website").text(), "", "origin is not updated");
      start();
    });
  });

  asyncTest("no password: start with bad token", function() {
    xhr.useResult("invalid");

    createController(config, function() {
      testCannotConfirm();
      start();
    });
  });

  asyncTest("no password: start with emailForVerficationToken XHR failure", function() {
    xhr.useResult("ajaxError");
    createController(config, function() {
      testHelpers.testErrorVisible();
      start();
    });
  });

  asyncTest("password: first secondary address added", function() {
    createPrimaryUser();
    createController(config, function() {
      equal($("body").hasClass("enter_password"), true, "enter_password added to body");
      testEmail();
      start();
    });
  });

  asyncTest("password: missing password", function() {
    $("#password").val();
    $("#vpassword").val("password");

    expectTooltipVisible();
  });

  asyncTest("password: missing verify password", function() {
    $("#password").val("password");
    $("#vpassword").val();

    expectTooltipVisible();
  });

  asyncTest("password: too short of a password", function() {
    $("#password").val("pass");
    $("#vpassword").val("pass");

    expectTooltipVisible();
  });

  asyncTest("password: mismatched passwords", function() {
    $("#password").val("passwords");
    $("#vpassword").val("password");

    expectTooltipVisible();
  });

  asyncTest("password: good password", function() {
    $("#password").val("password");
    $("#vpassword").val("password");

    createPrimaryUser();
    createController(config, function() {
      controller.submit(function(status) {
        equal(status, true, "correct status");
        equal($("body").hasClass("complete"), true, "body has complete class");
        start();
      });
    });
  });

  asyncTest("password: good password bad token", function() {
    $("#password").val("password");
    $("#vpassword").val("password");

    xhr.useResult("invalid");
    createPrimaryUser();
    createController(config, function() {
      testCannotConfirm();
      start();
    });
  });

}());
