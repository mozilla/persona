
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      Model = bid.Models.RpInfo,
      testHelpers = bid.TestHelpers;

  module("common/js/models/rp_info", {
    setup: function() {
      testHelpers.setup();
    },

    teardown: function() {
      testHelpers.teardown();
    }
  });

  test("getHostname returns hostname only, getOrigin returns full origin", function() {
    var model = Model.create({
      origin: "http://testuser.com:10002"
    });

    equal(model.getHostname(), "testuser.com");
    equal(model.getOrigin(), "http://testuser.com:10002");
  });

  test("getSiteName returns siteName if available, hostname if not", function() {
    var model = Model.create({
      origin: "http://testuser.com:10002",
      siteName: "my awesome site"
    });

    equal(model.getSiteName(), "my awesome site");

    var modelHostnameOnly = Model.create({
      origin: "http://testuser.com:10002"
    });

    equal(modelHostnameOnly.getSiteName(), "testuser.com");
  });

  test("getEmailableSiteLogo with dataURI siteLogo - siteLogo not emailable, no logo returned", function() {
    var model = Model.create({
      origin: "http://testuser.com",
      siteLogo: "data:image/png;base64,FAKEDATA"
    });

    testHelpers.testUndefined(model.getEmailableSiteLogo());
  });

  test("getEmailableSiteLogo with https siteLogo - logo returned", function() {
    var model = Model.create({
      origin: "http://testuser.com",
      siteLogo: "https://testuser.com/site_logo.png"
    });

    equal(model.getEmailableSiteLogo(), "https://testuser.com/site_logo.png");
  });

  test("isDefaultIssuer returns true if using default issuer", function() {
    var model = Model.create({
      origin: "http://testuser.com"
    });

    ok(model.isDefaultIssuer());
  });

  test("isDefaultIssuer returns false if using a forcedIssuer", function() {
    var model = Model.create({
      origin: "http://testuser.com",
      forceIssuer: "login.persona.org"
    });

    equal(model.isDefaultIssuer(), false);
  });

}());
