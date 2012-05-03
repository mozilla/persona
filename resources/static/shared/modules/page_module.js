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
      helpers = bid.Helpers,
      cancelEvent = helpers.cancelEvent,
      mediator = bid.Mediator;

   function onSubmit() {
     if (!dom.hasClass("body", "submit_disabled") && this.validate()) {
       this.submit();
     }
     return false;
   }

  function showScreen(screen, template, vars, oncomplete) {
    screen.show(template, vars);
    oncomplete && oncomplete();
  }

  function hideScreen(screen) {
    screen.hide();
  }

  var Module = BrowserID.Class({
    init: function(options) {
      options = options || {};

      var self=this;

      self.domEvents = [];
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
      self.options = options || {};

      self.bind("form", "submit", cancelEvent(onSubmit));
    },

    stop: function() {
      this.unbindAll();

      dom.removeClass("body", "waiting");
    },

    destroy: function() {
      this.stop();
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

    unbindAll: function() {
      var self=this,
          evt;

      while(evt = self.domEvents.pop()) {
        dom.unbindEvent(evt.target, evt.type, evt.cb);
      }
    },

    renderDialog: function(template, data) {
      var self=this;

      self.hideWait();
      self.hideError();
      self.hideDelay();

      screens.form.show(template, data);
      dom.focus("input:visible:not(:disabled):eq(0)");
      // XXX jQuery.  bleck.
      if($("*:focus").length === 0) {
        dom.focus("button:visible:eq(0)");
      }
    },

    renderWait: showScreen.curry(screens.wait),
    hideWait: hideScreen.curry(screens.wait),

    renderError: function(template, data, oncomplete) {
      screens.error.show(template, data);

      bid.ErrorDisplay.start();

      oncomplete && oncomplete(false);
    },

    hideError: hideScreen.curry(screens.error),
    renderDelay: showScreen.curry(screens.delay),
    hideDelay: hideScreen.curry(screens.delay),

    /**
     * Validate the form, if returns false when called, submit will not be
     * called on click.
     * @method validate.
     */
    validate: function() {
      return true;
    },

    /**
     * Submit the form.  Can be called to force override the
     * disableSubmit function.
     * @method submit
     */
    submit: function() {
    },

    // XXX maybe we should not get rid of this.
    close: function(message) {
      this.destroy();
      if (message) {
        this.publish.apply(this, arguments);
      }
    },

    /**
     * Publish a message to the mediator.
     * @method publish
     * @param {string} message
     * @param {object} data
     */
    publish: mediator.publish.bind(mediator),

    /**
     * Subscribe to a message on the mediator.
     * @method subscribe
     * @param {string} message
     * @param {function} callback
     * @param {object} [context] - context, if not given, use this.
     */
    subscribe: function(message, callback, context) {
      mediator.subscribe(message, callback.bind(context || this));
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

    // BEGIN TESTING API
    ,
    onSubmit: onSubmit
    // END TESTING API
  });

  return Module;

}());
