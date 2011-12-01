/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
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
      xhr = bid.Mocks.xhr,
      helpers = bid.TestHelpers,
      controller;

  function createController(config) {
    var config = $.extend({
      code_ver: "ABC123"
    }, config);

    controller = BrowserID.Modules.CodeCheck.create();
    controller.start(config);
  }

  module("controllers/code_check", {
    setup: function() {
      helpers.setup();
    },

    teardown: function() {
      helpers.teardown();

      controller.destroy();
    }
  });

  asyncTest("create controller with most recent scripts", function() {
    createController({
      ready: function(mostRecent) {
        equal(mostRecent, true, "scripts are the most recent");
        start();
      }
    });
  });

  test("create controller without code_ver specified", function() {
    raises(function() {
      createController({
        code_ver: null
      });
    }, "init: code_ver must be defined", "code version not specified throws exception");
  });

  asyncTest("create controller with out of date scripts", function() {
    var scriptCount = $("head > script").length;

    createController({
      code_ver: "ABC122",
      ready: function(mostRecent) {
        equal(mostRecent, false, "scripts are not the most recent");
        var scripts = $("head > script");
        var scriptAdded = scripts.length !== scriptCount;

        equal(scriptAdded, true, "a script was added to the dom to force reload");

        if(scriptAdded) {
          // Only remove the last script if the script was actually added.
          scripts.last().remove();
        }

        start();
      }
    });
  });

  asyncTest("create controller with XHR error during script check", function() {
    xhr.useResult("contextAjaxError");
    var scriptCount = $("head > script").length;

    createController({
      ready: function() {
        helpers.checkNetworkError();
        var scripts = $("head > script");
        var scriptAdded = scripts.length !== scriptCount;

        equal(scriptAdded, false, "a script was not added on XHR error");
        start();
      }
    });
  });

}());

