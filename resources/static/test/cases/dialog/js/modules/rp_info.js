/*jshint browser: true, forin: true, laxbreak: true */
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
      RP_NAME = "The Planet's Most Awesome Site",
      RP_TOS_URL = "https://browserid.org/TOS.html",
      RP_PP_URL = "https://browserid.org/priv.html",
      RP_HTTPS_LOGO = "https://en.gravatar.com/userimage/6966791/c4feac761b8544cce13e0406f36230aa.jpg",
      mediator = bid.Mediator;

  module("dialog/js/modules/rp_info", {
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
      try {
        var und;
        window.scriptRun = und;
        delete window.scriptRun;
      } catch(e) { /* IE8 blows up trying to delete scriptRun */ }

      testHelpers.teardown();
    }
  });


  function createController(options) {
    options = _.extend({ hostname: RP_HOSTNAME }, options);

    controller = bid.Modules.RPInfo.create();
    controller.start(options || {});
  }

  test("neither siteName nor logo specified - show rp_hostname only", function() {
    createController();
    equal($("#rp_hostname").html(), RP_HOSTNAME, "rp_hostname filled in");
    ok(!$("#rp_name").html(), "rp_name empty");
    ok(!$("#rp_logo").attr("src"), "rp logo not shown");
  });

  test("siteName only specified - show specified siteName and rp_hostname", function() {
    createController({
      siteName: RP_NAME,
    });

    equal($("#rp_hostname").html(), RP_HOSTNAME, "rp_hostname filled in");
    equal($("#rp_name").html(), RP_NAME, "rp_name filled in");
    ok(!$("#rp_logo").attr("src"), "rp logo not shown");
  });

  test("siteLogos are allowed", function() {
    var docMock = new WindowMock().document;
    docMock.location.protocol = "http:";

    createController({
      document: docMock,
      siteLogo: RP_HTTPS_LOGO
    });

    equal($("#rp_logo").attr("src"), RP_HTTPS_LOGO, "rp logo shown");
    equal($("#rp_hostname").html(), RP_HOSTNAME, "rp_hostname filled in");
    ok(!$("#rp_name").html(), "rp_name empty");
  });

  test("both siteName and siteLogo specified - show siteName, siteLogo and rp_hostname", function() {
    createController({
      siteName: RP_NAME,
      siteLogo: RP_HTTPS_LOGO
    });

    equal($("#rp_hostname").html(), RP_HOSTNAME, "rp_hostname filled in");
    equal($("#rp_name").html(), RP_NAME, "rp_name filled in");
    equal($("#rp_logo").attr("src"), RP_HTTPS_LOGO, "rp logo shown");
  });

  test("privacyPolicy, termsOfService specified - show TOS/PP info", function() {
    createController({
      siteName: RP_NAME,
      privacyPolicy: RP_PP_URL,
      termsOfService: RP_TOS_URL
    });

    equal($("#rp_name").text(), RP_NAME, "RP's name is set");
    equal($("#rp_tos").attr("href"), RP_TOS_URL, "RP's TOS is set");
    equal($("#rp_pp").attr("href"), RP_PP_URL, "RP's Privacy Policy is set");
  });

}());

