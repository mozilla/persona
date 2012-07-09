/*jshint browser:true, jquery: true, forin: true, laxbreak:true */
/*globals BrowserID: true, _:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  var bid = BrowserID,
      ExtendedInfo = bid.Modules.ExtendedInfo;

  module("common/js/modules/extended-info", {
    setup: function() {
        $("#error").html("<div class='contents'><a href='#' class='openMoreInfo'>Open</a><div class='moreInfo' style='display:none'>Expanded Info</div></div>");
    },
    teardown: function() {
      $("#error").hide();
    }
  });

  asyncTest("can initialize and open the extended info", function openExtendedInfo() {
    $("#error").show();
    var errorDisplay = ExtendedInfo.create();
    errorDisplay.start({ target: "#error" });
    errorDisplay.open(function() {
      ok($("#error .moreInfo").is(":visible"), "expanded info is visible");
      start();
    });
  });


}());
