/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      network = bid.Network,
      xhr = bid.Mocks.xhr,
      helpers = bid.TestHelpers,
      controller;

  function createController(config) {
    var config = $.extend({
      code_ver: "ABC123",
      environment: "PRODUCTION"
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

  asyncTest("create controller with 'environment: DEBUG' - no code check performed", function() {
    var scriptCount = $("head > script").length;

    createController({
      environment: "DEBUG",
      ready: function(mostRecent) {
        equal(mostRecent, true, "working on the most recent version");

        var scripts = $("head > script");
        var scriptAdded = scripts.length !== scriptCount;

        equal(scriptAdded, false, "a script was not added");

        if(scriptAdded) {
          // Only remove the last script if the script was actually added.
          scripts.last().remove();
        }

        start();
      }
    });
  });

  asyncTest("create controller with most recent scripts", function() {
    createController({
      ready: function(mostRecent) {
        equal(mostRecent, true, "scripts are the most recent");
        start();
      }
    });
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

