/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


BrowserID.Modules.CodeCheck = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      sc,
      expectedCodeVer,
      fileNamePrefix;

  function getMostRecentCodeVersion(oncomplete) {
    bid.Network.codeVersion(oncomplete, this.getErrorDialog(bid.Errors.checkScriptVersion, oncomplete));
  }

  function updateCodeIfNeeded(oncomplete, version) {
    var mostRecent = version === expectedCodeVer;

    function ready() {
      oncomplete && oncomplete(mostRecent);
    }

    if(mostRecent) {
      ready();
    }
    else {
      loadScript(version, ready);
    }
  }

  function loadScript(version, oncomplete) {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://browserid.org/production/" + fileNamePrefix + "_v" + version + ".js";
    document.head.appendChild(script);

    oncomplete();
  }

  var Module = bid.Modules.PageModule.extend({
      start: function(data) {
        var self=this;

        function complete(val) {
          data.ready && data.ready(val);
        }

        data = data || {};

        self.checkRequired(data, "code_ver", "file_name_prefix");
        expectedCodeVer = data.code_ver;
        fileNamePrefix = data.file_name_prefix;

        getMostRecentCodeVersion.call(self, function(version) {
          if(version) {
            updateCodeIfNeeded.call(self, complete, version);
          }
          else {
            complete(true);
          }
        });

        sc.start.call(self, data);
      }
  });

  sc = Module.sc;

  return Module;

}());

