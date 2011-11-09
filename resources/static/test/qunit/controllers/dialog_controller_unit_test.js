/*jshint browsers:true, forin: true, laxbreak: true */
/*global steal: true, test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
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
steal.plugins("jquery").then("/dialog/controllers/page_controller", "/dialog/controllers/dialog_controller", function() {
  "use strict";

  var controller,
      el,
      channelError = false;

  function reset() {
    el = $("#controller_head");
    el.find("#formWrap .contents").html("");
    el.find("#wait .contents").html("");
    el.find("#error .contents").html("");

    channelError = false;
  }

  function initController() {
    controller = el.dialog({
      window: {
        setupChannel: function() { 
          if (channelError) throw "Channel error";  
        }
      }
    }).controller();
  }

  module("controllers/dialog_controller", {
    setup: function() {
      reset();
      initController();
    },

    teardown: function() {
      controller.destroy();
      reset();
    } 
  });

  test("initialization with channel error", function() {
    controller.destroy();
    reset();
    channelError = true;

    initController();

    ok($("#error .contents").text().length, "contents have been written");
  });

  test("doOffline", function() {
    controller.doOffline();
    ok($("#error .contents").text().length, "contents have been written");
    ok($("#error #offline").text().length, "offline error message has been written");
  });

  test("doXHRError while online, no network info given", function() {
    controller.doXHRError();
    ok($("#error .contents").text().length, "contents have been written");
    ok($("#error #action").text().length, "action contents have been written");
    equal($("#error #network").text().length, 0, "no network contents to be written");
  });

  test("doXHRError while online, network info given", function() {
    controller.doXHRError({
      network: {
        type: "POST",
        url: "browserid.org/verify"
      }
    });
    ok($("#error .contents").text().length, "contents have been written");
    ok($("#error #action").text().length, "action contents have been written");
    ok($("#error #network").text().length, "network contents have been written");
  });

  test("doXHRError while offline does not update contents", function() {
    controller.doOffline();
    $("#error #action").remove();

    controller.doXHRError();
    ok(!$("#error #action").text().length, "XHR error is not reported if the user is offline.");
  });


});

