/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*globals BrowserID: true, _:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.StateMachine = (function() {
  "use strict";

  var bid = BrowserID,
      History = bid.History,
      history,
      mediator = bid.Mediator,
      subscriptions = []

  var StateMachine = bid.Class({
    init: function() {},

    start: function(options) {
      options = options || {};
      history = options.history || History.create();
    },

    stop: function() {
      var subscription;

      while(subscription = subscriptions.pop()) {
        mediator.unsubscribe(subscription);
      }
    },

    destroy: function() {
      this.stop();
    },

    subscribe: function(message, callback) {
      subscriptions.push(mediator.subscribe(message, function(msg, info, rehydrate) {
        if(rehydrate) {
          var cmd = history.getCurrent();
          if(cmd) cmd.extendRunOptions(rehydrate);
        }
        callback(msg, info);
      }));
    },

    gotoState: function(save, callback, options) {
      if (typeof save !== "boolean") {
        options = callback;
        callback = save;
        save = true;
      }

      // only save the current state when a new state comes in.
      var cmd = history.getCurrent();
      if(cmd && cmd.save) {
        // XXX saveState should be renamed to pushState
        history.saveState();
      }

      var cmd = history.createState(callback, options);
      cmd.save = save;
      cmd.run();
    },

    popState: function() {
      var cmd = history.popState();
      if(cmd) {
        cmd.run();
      }
    }
  });

  return StateMachine;
}());
