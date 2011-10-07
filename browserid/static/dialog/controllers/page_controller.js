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

  var bid = BrowserID,  
      ANIMATION_TIME = 250,
      identities = bid.Identities;


  $.Controller.extend("PageController", {
    }, {
    init: function(options) {
      var me=this,
          bodyTemplate = options.bodyTemplate,
          bodyVars = options.bodyVars;


      me.renderTemplates(bodyTemplate, bodyVars);

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

    renderTemplates: function(body, body_vars) {
      $("body").removeClass("waiting");

      if (body) {
        var bodyHtml = $.View("//dialog/views/" + body, body_vars);
        var form = $("#formWrap > form");
        form.html(bodyHtml).hide().fadeIn(ANIMATION_TIME, function() {
          form.find("input").eq(0).focus(); 
        });
      }
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
      this.renderTemplates("wait.ejs", {title: info.message, message: info.description});

      $("body").addClass("waiting");
    },

    close: function(message, data) {
      this.destroy();
      if (message) {
        this.publish(message, data);
      }
    },

    /**
     * Immediately show the error dialog
     * @method errorDialog
     * @param {object} info - info to use for the error dialog.  Should have 
     * two fields, message, description.
     */
    errorDialog: function(info) {
      $("#dialog").hide();

      $("#error_dialog .title").text(info.message);
      $("#error_dialog .content").text(info.description);

      $("body").removeClass("authenticated").addClass("error");

      $("#error_dialog").fadeIn(ANIMATION_TIME);
    },

    /**
     * Get a curried function to an error dialog.
     * @method getErrorDialog
     * @method {object} info - info to use for the error dialog.  Should have 
     * two fields, message, description.
     */
    getErrorDialog: function(info) {
      var self=this;
      return self.errorDialog.bind(self, info);
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
