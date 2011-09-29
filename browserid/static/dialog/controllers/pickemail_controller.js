/*jshint brgwser:true, jQuery: true, forin: true, laxbreak:true */                                             
/*global _: true, BrowserIDIdentities: true, PageController: true */ 
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

  var identities = BrowserIDIdentities;

  PageController.extend("Pickemail", {}, {
    init: function(options) {
      this._super({
        bodyTemplate: "pickemail.ejs",
        bodyVars: {
          sitename: identities.getOrigin(),
          siteicon: '/i/times.gif',
          identities: identities.getStoredEmailKeypairs(),
        }
      });
      // select the first option
      this.find('input:first').attr('checked', true);
      this.submitAction = "signIn";
    },

    submit: function() {
      this[this.submitAction]();
    },

    signIn: function() {
      var me=this;
      $("#signIn").animate({"width" : "685px"}, "slow", function () {
        // post animation
         $("body").delay(500).animate({ "opacity" : "0.5"}, "fast", function () {
            var email = $("#inputs input:checked").val();
            me.close("email_chosen", {
              email: email
            });
         });
      }); 
    },

    addEmail: function() {
      var email = $("#newEmail").val(),
          me=this;

      if (email) {
        identities.addEmail(email, function(keypair) {
          if (keypair) {
            me.close("email_staged", {
              email: email
            });
          }
          else {
            // XXX BAAAAAAAAAAAAAH.
          }
        }, function onFailure() {

        });
      }
    },

    "#useDifferentEmail click": function(element, event) {
      event.preventDefault();

      this.submitAction = "addEmail";

      $("#signInButton,#useDifferentEmail").fadeOut(250, function() {
        $("#differentEmail").fadeIn(250);
        $("#newEmail").focus();
      });
    },

    "#cancelDifferentEmail click": function(element, event) {
      event.preventDefault();

      this.submitAction = "signIn";

      $("#differentEmail").fadeOut(250, function() {
        $("#signInButton,#useDifferentEmail").fadeIn(250);
      });
    }

  });

}());
