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
      dom = bid.DOM;


  $.Controller.extend("PageController", {
    }, {
    init: function(el, options) {
      options = options || {};

      var me=this,
          bodyTemplate = options.bodyTemplate,
          bodyVars = options.bodyVars,
          errorTemplate = options.errorTemplate,
          errorVars = options.errorVars,
          waitTemplate = options.waitTemplate,
          waitVars = options.waitVars;


      if(bodyTemplate) {
        me.renderDialog(bodyTemplate, bodyVars);
      }

      if(waitTemplate) {
        me.renderWait(waitTemplate, waitVars);
      }

      if(errorTemplate) {
        me.renderError(errorTemplate, errorVars);
      }

      // XXX move all of these, bleck.
      dom.bindEvent("form", "submit", me.onSubmit.bind(me));
      dom.bindEvent("#cancel", "click", me.onCancel.bind(me));
      dom.bindEvent("#back", "click", me.onBack.bind(me));
      dom.bindEvent("#thisIsNotMe", "click", me.close.bind(me, "notme"));
    },

    destroy: function() {
      dom.unbindEvent("form", "submit");
      dom.unbindEvent("input", "keyup");
      dom.unbindEvent("#cancel", "click");
      dom.unbindEvent("#back", "click");
      dom.unbindEvent("#thisIsNotMe", "click");

      dom.removeClass("body", "waiting");

      this._super();
    },

    renderTemplates: function(target, body, body_vars) {
      if (body) {
        var bodyHtml = new EJS({url: "/dialog/views/" + body}).render(body_vars);
        target = $(target + " .contents");
        target.html(bodyHtml).find("input").eq(0).focus();
      }
    },

    renderDialog: function(body, body_vars) {
      this.renderTemplates("#formWrap", body, body_vars);
      dom.removeClass("body", "error");
      dom.removeClass("body", "waiting");
      dom.addClass("body", "form");
      $("#wait, #error").stop().fadeOut(ANIMATION_TIME);
    },

    renderWait: function(body, body_vars) {
      this.renderTemplates("#wait", body, body_vars);
      dom.removeClass("body", "error");
      dom.removeClass("body", "form");
      dom.addClass("body", "waiting");
      $("body").css('opacity', 1);
      $("#wait").stop().hide().fadeIn(ANIMATION_TIME);
    },

    renderError: function(body, body_vars) {
      this.renderTemplates("#error", body, body_vars);
      dom.removeClass("body", "waiting");
      dom.removeClass("body", "form");
      dom.addClass("body", "error");
      $("#error").stop().css('opacity', 1).hide().fadeIn(ANIMATION_TIME);

      /**
       * What a big steaming pile, use CSS animations for this!
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
      this.renderWait("wait.ejs", info);

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
        self.renderError("error.ejs", $.extend({
          action: action
        }, lowLevelInfo));
      }
    },

    onCancel: function(event) {
      event.preventDefault();
      event.stopPropagation();
      this.close("cancel");
    },

    onBack: function(event) {
      event.preventDefault();
      event.stopPropagation();
      this.close("start");
    }
  });

}());
