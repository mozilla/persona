/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */                                             
/*global Channel:true, CryptoStubs:true, alert:true, errorOut:true, setupChannel:true, getEmails:true, clearEmails: true, console: true, _: true, pollTimeout: true, addEmail: true, removeEmail:true, BrowserIDNetwork: true, BrowserIDWait:true, BrowserIDErrors: true, runErrorDialog:true */ 
//
// a JMVC controller for the browserid dialog
//

(function() {
"use strict";

  $.Controller.extend("PageController", {
    }, {
    init: function(options) {
      var bodyTemplate = options.bodyTemplate;
      var bodyVars = options.bodyVars;
      var footerTemplate = options.footerTemplate;
      var footerVars = options.footerVars;

      this.renderTemplates(bodyTemplate, bodyVars, footerTemplate, footerVars);
      $("form").bind("submit", this.onSubmit.bind(this));
    },

    destroy: function() {
      $("form").unbind("submit");
      $("input").unbind("keyup");
      this._super();
    },

    renderTemplates: function(body, body_vars, footer, footer_vars) {
      if (body) {
        var bodyHtml = $.View("//dialog/views/" + body, body_vars);
        $("#dialog").html(bodyHtml).hide().fadeIn(300, function() {
          $("#dialog input").eq(0).focus(); 
        });
      }

      if (footer) {
        var footerHtml = $.View("//dialog/views/" + footer, footer_vars);
        $("#bottom-bar").html(footerHtml);
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
      this.close("submit");
    },

    doWait: function(info) {
      this.renderTemplates("wait.ejs", {title: info.message, message: info.description});
    },

    close: function(message, data) {
      this.destroy();
      if (message) {
        this.publish(message, data);
      }
    },

    runErrorDialog: function(info) {
      $(".dialog").hide();

      $("#error_dialog div.title").text(info.message);
      $("#error_dialog div.content").text(info.description);

      $("#back").hide();
      $("#cancel").hide();
      $("#submit").show().unbind("click").click(function() {
      }).text("Close");

      $("#error_dialog").fadeIn(500);
    },

    "#cancel click": function() {
      this.close("cancel");
    },

    "#back click": function(event) {
      this.close("start");
    }



  });

}());
