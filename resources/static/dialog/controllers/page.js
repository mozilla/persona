/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID: true*/
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

  var PageController = BrowserID.Class({
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
      screens.wait.hide();
      screens.error.hide();
      screens.form.show(body, body_vars);
      dom.focus("input:visible:not(:disabled):eq(0)");
    },

    renderWait: function(body, body_vars) {
      screens.wait.show(body, body_vars);
    },

    renderError: function(body, body_vars, oncomplete) {
      screens.error.show(body, body_vars);

      bid.ErrorDisplay.start();

      $("#error").stop().css('opacity', 1).hide().fadeIn(ANIMATION_TIME, function() {
        if(oncomplete) oncomplete(false);
      });
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

  return PageController;

}());
