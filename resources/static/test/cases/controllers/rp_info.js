/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var controller,
      bid = BrowserID,
      user = bid.User,
      testHelpers = bid.TestHelpers,
      register = bid.TestHelpers.register,
      WindowMock = bid.Mocks.WindowMock,
      RP_HOSTNAME = "hostname.org",
      RP_NAME = "RP Name",
      RP_HTTPS_LOGO = "https://en.gravatar.com/userimage/6966791/c4feac761b8544cce13e0406f36230aa.jpg";

  module("controllers/rp_info", {
    setup: testHelpers.setup,

    teardown: function() {
      if (controller) {
        try {
          controller.destroy();
          controller = null;
        } catch(e) {
          // could already be destroyed from the close
        }
      }
      window.scriptRun = null;
      delete window.scriptRun;
      testHelpers.teardown();
    }
  });


  function createController(options) {
    options = _.extend({ hostname: RP_HOSTNAME }, options);

    controller = bid.Modules.RPInfo.create();
    controller.start(options || {});
  }

  test("neither name nor logo specified - use site's rp_hostname as name", function() {
    createController();
    equal($("#rp_hostname").html(), RP_HOSTNAME, "rp_hostname filled in");
    ok(!$("#rp_name").html(), "rp_name empty");
    ok(!$("#rp_logo").attr("src"), "rp logo not shown");
  });

  test("name only specified - show specified name and rp_hostname", function() {
    createController({
      name: RP_NAME,
    });

    equal($("#rp_hostname").html(), RP_HOSTNAME, "rp_hostname filled in");
    equal($("#rp_name").html(), RP_NAME, "rp_name filled in");
    ok(!$("#rp_logo").attr("src"), "rp logo not shown");
  });

  test("logoURLs are allowed", function() {
    var docMock = new WindowMock().document;
    docMock.location.protocol = "http:";

    createController({
      document: docMock,
      logoURL: RP_HTTPS_LOGO
    });

    equal($("#rp_logo").attr("src"), RP_HTTPS_LOGO, "rp logo shown");
    equal($("#rp_hostname").html(), RP_HOSTNAME, "rp_hostname filled in");
    ok(!$("#rp_name").html(), "rp_name empty");
  });

  test("both name and logo specified - show name, logo and rp_hostname", function() {
    createController({
      name: RP_NAME,
      logoURL: RP_HTTPS_LOGO
    });

    equal($("#rp_hostname").html(), RP_HOSTNAME, "rp_hostname filled in");
    equal($("#rp_name").html(), RP_NAME, "rp_name filled in");
    equal($("#rp_logo").attr("src"), RP_HTTPS_LOGO, "rp logo shown");
  });

}());

