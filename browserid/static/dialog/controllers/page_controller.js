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

  var ANIMATION_TIME = 250;


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
      $("form").bind("submit", me.onSubmit.bind(me));
      $("#cancel").click(me.onCancel.bind(me));
      $("#back").click(me.onBack.bind(me));
      $("#thisIsNotMe").click(me.close.bind(me, "notme"));
    },

    destroy: function() {
      $("form").unbind("submit");
      $("input").unbind("keyup");
      $("#cancel").unbind("click");
      $("#back").unbind("click");
      $("#thisIsNotMe").unbind("click");

      $("body").removeClass("waiting");

      this._super();
    },

    renderTemplates: function(target, body, body_vars) {
      if (body) {
        var bodyHtml = $.View("//dialog/views/" + body, body_vars);
        target = $(target + " .contents");
        target.html(bodyHtml).find("input").eq(0).focus(); 
      }
    },

    renderDialog: function(body, body_vars) {
      this.renderTemplates("#formWrap", body, body_vars);
      $("body").removeClass("error").removeClass("waiting").addClass("form");
      $("#wait, #error").stop().fadeOut(ANIMATION_TIME);
    },

    renderWait: function(body, body_vars) {
      this.renderTemplates("#wait", body, body_vars);
      $("body").removeClass("error").removeClass("form").addClass("waiting").css('opacity', 1);
      $("#wait").stop().hide().fadeIn(ANIMATION_TIME);
    },

    renderError: function(body, body_vars) {
      this.renderTemplates("#error", body, body_vars);
      $("body").removeClass("waiting").removeClass("form").addClass("error");
      $("#error").stop().css('opacity', 1).hide().fadeIn(ANIMATION_TIME);
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

      $("body").addClass("waiting");
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
     * @method {object} info - info to use for the error dialog.  Should have 
     * two fields, message, description.
     */
    getErrorDialog: function(info) {
      var self=this;
      return self.renderError.bind(self, "wait.ejs", info);
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
