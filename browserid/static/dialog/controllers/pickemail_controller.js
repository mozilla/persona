/*jshint brgwser:true, jQuery: true, forin: true, laxbreak:true */                                             
/*global Channel:true, CryptoStubs:true, alert:true, errorOut:true, setupChannel:true, getEmails:true, clearEmails: true, console: true, _: true, pollTimeout: true, addEmail: true, removeEmail:true, BrowserIDNetwork: true, BrowserIDWait:true, BrowserIDErrors: true, PageController: true */ 
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

  PageController.extend("Pickemail", {}, {
    init: function(options) {
      this._super({
        bodyTemplate: "pickemail.ejs",
        bodyVars: {
          sitename: BrowserIDNetwork.origin,
          siteicon: '/i/times.gif',
          identities: getEmails()
        }
      });
      // select the first option
      this.find('input:first').attr('checked', true);
    },

    submit: function() {
      var me=this;
      $("#signIn").animate({"width" : "685px"}, "slow", function () {
        // post animation
         $("body").delay(500).animate({ "opacity" : "0.5"}, "fast", function () {
            var email = $("#inputs input:checked").val();
            me.close("pickemail:complete", {
              email: email
            });
         });
      }); 
    },

    "#signInButton click": function() {
      this.submit();
    },

    "#useDifferentEmail click": function() {
      //this.close("pickemail:addemail");
      $("#signInButton").hide();
      $("#differentEmail").slideDown(300);
      $("#newEmail").focus();
    }

  });

}());
