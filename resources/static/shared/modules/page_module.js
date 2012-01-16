/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID: true*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules = BrowserID.Modules || {};
BrowserID.Modules.PageModule = (function() {
"use strict";

  var ANIMATION_TIME = 250,
      bid = BrowserID,
      dom = bid.DOM,
      screens = bid.Screens,
      mediator = bid.Mediator;

   function onSubmit(event) {
     event.stopPropagation();
     event.preventDefault();

     if (this.validate()) {
       this.submit();
     }
     return false;
   }

  var Module = BrowserID.Class({
    init: function(options) {
      options = options || {};

      var self=this;

      self.domEvents = [];

      if(options.bodyTemplate) {
        self.renderDialog(options.bodyTemplate, options.bodyVars);
      }

      if(options.waitTemplate) {
        self.renderWait(options.waitTemplate, options.waitVars);
      }

      if(options.errorTemplate) {
        self.renderError(options.errorTemplate, options.errorVars);
      }
    },

    checkRequired: function(options) {
      var list = [].slice.call(arguments, 1);
      for(var item, index = 0; item = list[index]; ++index) {
        if(!options.hasOwnProperty(item)) {
          throw "missing config option: " + item;
        }
      }
    },

    start: function(options) {
      var self=this;
      self.bind("form", "submit", onSubmit);
      self.bind("#thisIsNotMe", "click", self.close.bind(self, "notme"));
    },

    stop: function() {
      this.unbindAll();

      dom.removeClass("body", "waiting");
    },

    destroy: function() {
      this.stop();
    },

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

    unbindAll: function() {
      var self=this,
          evt;

      while(evt = self.domEvents.pop()) {
        dom.unbindEvent(evt.target, evt.type, evt.cb);
      }
    },

    renderDialog: function(body, body_vars) {
      var self=this;

      self.hideWait();
      self.hideError();

      screens.form.show(body, body_vars);
      dom.focus("input:visible:not(:disabled):eq(0)");
    },

    renderWait: function(body, body_vars) {
      screens.wait.show(body, body_vars);
    },

    hideWait: function() {
      screens.wait.hide();
    },

    renderError: function(body, body_vars, oncomplete) {
      screens.error.show(body, body_vars);

      bid.ErrorDisplay.start();

      $("#error").stop().css('opacity', 1).hide().fadeIn(ANIMATION_TIME, function() {
        if(oncomplete) oncomplete(false);
      });
    },

    hideError: function() {
      screens.error.hide();
    },

    validate: function() {
      return true;
    },

    submit: function() {
    },

    close: function(message, data) {
      this.destroy();
      if (message) {
        this.publish(message, data);
      }
    },

    publish: function(message, data) {
      mediator.publish(message, data);
    },

    subscribe: function(message, callback) {
      mediator.subscribe(message, callback.bind(this));
    },

    /**
     * Get a curried function to an error dialog.
     * @method getErrorDialog
     * @method {object} action - info to use for the error dialog.  Should have
     * @method {function} [onerror] - callback to call after the
     * error has been displayed.
     * two fields, message, description.
     */
    getErrorDialog: function(action, onerror) {
      var self=this;
      return function(lowLevelInfo) {
        self.renderError("error", $.extend({
          action: action
        }, lowLevelInfo), onerror);
      };
    }
  });

  return Module;

}());
