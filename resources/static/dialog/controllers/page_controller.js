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
(function() {
"use strict";

  var ANIMATION_TIME = 250,
      bid = BrowserID,
      dom = bid.DOM,
      screens = bid.Screens;


  $.Controller.extend("PageController", {
    }, {
    init: function(el, options) {
      options = options || {};

      var self=this;

      if(options.bodyTemplate) {
        self.renderDialog(options.bodyTemplate, options.bodyVars);
      }

      if(options.waitTemplate) {
        self.renderWait(options.waitTemplate, options.waitVars);
      }

      if(options.errorTemplate) {
        self.renderError(options.errorTemplate, options.errorVars);
      }

      self.start(options);
    },

    start: function() {
      var self=this;
      // XXX move all of these, bleck.
      dom.bindEvent("form", "submit", self.onSubmit.bind(self));
      dom.bindEvent("#thisIsNotMe", "click", self.close.bind(self, "notme"));
    },

    stop: function() {
      dom.unbindEvent("form", "submit");
      dom.unbindEvent("input", "keyup");
      dom.unbindEvent("#thisIsNotMe", "click");

      dom.removeClass("body", "waiting");
    },

    destroy: function() {
      this.stop();
      this._super();
    },

    renderDialog: function(body, body_vars) {
      screens.form(body, body_vars);
      $("#wait, #error").stop().fadeOut(ANIMATION_TIME);
      dom.focus("input:visible:eq(0)");
    },

    renderWait: function(body, body_vars) {
      screens.wait(body, body_vars);
      $("body").css('opacity', 1);
      $("#wait").stop().hide().fadeIn(ANIMATION_TIME);
    },

    renderError: function(body, body_vars) {
      screens.error(body, body_vars);
      $("#error").stop().css('opacity', 1).hide().fadeIn(ANIMATION_TIME);

      /**
       * TODO XXX - Use the error-display for this.
       */
      dom.bindEvent("#openMoreInfo", "click", function(event) {
        event.preventDefault();

        $("#moreInfo").slideDown();
        $("#openMoreInfo").css({visibility: "hidden"});
      });
    },

    onSubmit: function(event) {
      event.stopPropagation();
      event.preventDefault();

      if (this.validate()) {
        this.submit();
      }
      return false;
    },

    validate: function() {
      return true;
    },

    submit: function() {
    //  this.close("submit");
    },

    doWait: function(info) {
      this.renderWait("wait", info);

      dom.addClass("body", "waiting");
    },

    close: function(message, data) {
      this.destroy();
      if (message) {
        this.publish(message, data);
      }
    },

    /**
     * Get a curried function to an error dialog.
     * @method getErrorDialog
     * @method {object} action - info to use for the error dialog.  Should have
     * two fields, message, description.
     */
    getErrorDialog: function(action) {
      var self=this;
      return function(lowLevelInfo) {
        self.renderError("error", $.extend({
          action: action
        }, lowLevelInfo));
      }
    }
  });

}());
