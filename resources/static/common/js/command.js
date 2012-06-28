/*globals BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Command = (function() {
  "use strict";

  var bid = BrowserID;

  var Command = bid.Class({
    init: function(options) {
      this.run_options = options.run_options || {};
      if(!options.callback) {
        throw "callback required";
      }
      this.callback = options.callback;
    },

    run: function() {
      this.callback(this.run_options);
    },

    extendRunOptions: function(options) {
      _.extend(this.run_options, options);
    }
  });

  return Command;
}());

