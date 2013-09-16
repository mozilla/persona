
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
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

  test("getEmailableSiteLogo with dataURI siteLogo - siteLogo not emailable, no logo returned", function() {
    var model = Model.create({
      siteLogo: "data:image/png;base64,FAKEDATA"
    });

    testHelpers.testUndefined(model.getEmailableSiteLogo());
  });

  test("getEmailableSiteLogo with https siteLogo - logo returned", function() {
    model = Model.create({
      siteLogo: "https://testuser.com/site_logo.png"
    });

    equal(model.getEmailableSiteLogo(), "https://testuser.com/site_logo.png");
  });

}());
