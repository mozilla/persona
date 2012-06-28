/*globals BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.History = (function() {
  "use strict";

  var bid = BrowserID,
      Command = bid.Command;

  var History = bid.Class({
    init: function() {
      this.history = [];
    },

    destroy: function() {
      this.history = null;
    },

    createState: function(callback, options) {
      this.current = Command.create({
        callback: callback,
        run_options: options
      });
      return this.current;
    },

    getCurrent: function() {
      return this.current;
    },

    // XXX this should be renamed to pushState
    saveState: function() {
      this.history.push(this.current);
    },

    getTop: function() {
      return this.history[this.history.length - 1];
    },

    popState: function() {
      this.current = this.history.pop();
      return this.current;
    }
  });

  return History;
}());
