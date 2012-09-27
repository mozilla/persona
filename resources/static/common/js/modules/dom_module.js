/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.DOMModule = (function() {
"use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      helpers = bid.Helpers,
      cancelEvent = helpers.cancelEvent,
      mediator = bid.Mediator,
      sc;

  /*
   * DOMModule provides modules DOM related functionality.
   */

  var Module = bid.Modules.Module.extend({
    init: function(options) {
      sc.init.call(this, options);

      this.domEvents = [];
    },

    stop: function() {
      this.unbindAll();
      sc.stop.call(this);
    },

    /**
     * Bind a dom event
     * @method bind
     * @param {string} target - css selector
     * @param {string} type - event type
     * @param {function} callback
     * @param {object} [context] - optional context, if not given, use this.
     */
    bind: function(target, type, callback, context) {
      var self=this,
          cb = callback.bind(context || this);

      dom.bindEvent(target, type, cb);

      self.domEvents.push({
        target: target,
        type: type,
        cb: cb
      });
    },

    /**
     * Shortcut to bind a click handler
     * @method click
     * @param {string}
     * @param {function} callback
     * @param {object} [context] - optional context, if not given, use this.
     */
    click: function(target, callback, context) {
      this.bind(target, "click", cancelEvent(callback), context);
    },

    /**
     * Unbind all DOM event handlers
     * @method unbindAll
     */
    unbindAll: function() {
      var self=this,
          evt;

      while(evt = self.domEvents.pop()) {
        dom.unbindEvent(evt.target, evt.type, evt.cb);
      }
   }

  });

  sc = Module.sc;

  return Module;

}());
