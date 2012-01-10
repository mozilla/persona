/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*globals BrowserID: true, _:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      renderer = bid.Renderer;

  module("shared/renderer", {
    setup: function() {

    },

    teardown: function() {

    }
  });

  test("render template loaded using XHR", function() {
    $("#formWrap .contents").empty();
    $("#templateInput").remove();

    renderer.render("#formWrap .contents", "testBodyTemplate");

    ok($("#templateInput").length, "template written when loaded using XHR");
  });

  test("render template from memory", function() {
    $("#formWrap .contents").empty();
    $("#templateInput").remove();

    renderer.render("#formWrap .contents", "inMemoryTemplate");

    ok($("#templateInput").length, "template written when loaded from memory");
  });

  test("append template to element", function() {
    $("#formWrap .contents").empty();
    $("#templateInput").remove();

    renderer.append("#formWrap", "inMemoryTemplate");

    ok($("#formWrap > #templateInput").length && $("#formWrap > .contents"), "template appended to element instead of overwriting it");

  });
}());


