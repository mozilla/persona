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
steal.plugins("jquery").then("/dialog/controllers/page_controller", "/dialog/controllers/pickemail_controller", function() {
  "use strict";

  var controller, 
      el = $("body"),
      storage = BrowserID.Storage;

  function reset() {
    el = $("#controller_head");
    el.find("#formWrap .contents").html("");
    el.find("#wait .contents").html("");
    el.find("#error .contents").html("");
  }

  module("controllers/pickemail_controller", {
    setup: function() {
      reset();
      storage.clear();
    },

    teardown: function() {
      if (controller) {
        controller.destroy();
      }    
      reset();
      storage.clear();
    } 
  });


  test("pickemail controller with email associated with site", function() {
    storage.addEmail("testuser@testuser.com", {priv: "priv", pub: "pub"});
    storage.addEmail("testuser2@testuser.com", {priv: "priv", pub: "pub"});
    storage.setSiteEmail("browserid.org", "testuser2@testuser.com");

    controller = el.pickemail({origin: "browserid.org"}).controller();
    ok(controller, "controller created");

    var radioButton = $("input[type=radio]").eq(1);
    ok(radioButton.is(":checked"), "the email address we specified is checked");

    var label = radioButton.parent();;
    ok(label.hasClass("preselected"), "the label has the preselected class");
  });

  test("pickemail controller without email associated with site", function() {
    storage.addEmail("testuser@testuser.com", {priv: "priv", pub: "pub"});

    controller = el.pickemail({origin: "browserid.org"}).controller();
    ok(controller, "controller created");

    var radioButton = $("input[type=radio]").eq(0);
    equal(radioButton.is(":checked"), false, "The email address is not checked");

    var label = radioButton.parent();
    equal(label.hasClass("preselected"), false, "the label has no class");
  });

});

