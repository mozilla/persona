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
      subscriptions = [],
      saveLast;

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

      if(saveLast) {
        history.saveState();
      }

      saveLast = save;

      var cmd = history.createState(callback, options);
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
