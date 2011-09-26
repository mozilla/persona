/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserIDIdentities: true, BrowserIDNetwork: true, BrowserIDWait:true, BrowserIDErrors: true, PageController: true */
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
  // XXX  this needs changed so that the create account/authenticate flow is 
  // cleaner.  Right now we are trying to authenticate on every "enter" press, 
  // this is no good.
  var network = BrowserIDNetwork,
      identities = BrowserIDIdentities;

  PageController.extend("Authenticate", {}, {
    init: function() {
      this._super({
        bodyTemplate: "authenticate.ejs",
        bodyVars: {
          sitename: BrowserIDNetwork.origin,
          siteicon: '/i/times.gif'
        },
        className: 'authenticate'
      });
    },

    "#email click" : function(event) {
      $(".returning:visible,.newuser:visible").fadeOut(ANIMATION_TIME, function() {
        $(".start").fadeIn();
      });
    },

    "#next click": function(event) {
      var email = $("#email").val();
 
      // XXX verify email length/format here
      // show error message if bad.
      network.haveEmail(email, function onComplete(registered) {
        // XXX instead of using jQuery here, think about using CSS animations.
        $(".start").fadeOut(function() {
          if(registered) {
            $(".newuser").fadeOut(ANIMATION_TIME, function() {
              $(".returning").fadeIn(ANIMATION_TIME, function() {
                $("#password").focus();  
              });
            });
          }
          else {
            $(".returning").fadeOut(ANIMATION_TIME, function() {
              $(".newuser").fadeIn(ANIMATION_TIME);
            });
          }
        })
      });
    },

    "#signInButton click": function(event) {
      this.submit();
    },

    "#forgotpassword click": function(event) {
      var email = $("#email").val();
      this.close("authenticate:forgotpassword", {
        email: email  
      });
    },

    "#create click": function(event) {
      var self = this,
          email = $("#email").val();

      identities.createUser(email, function(keypair) {
          self.close("createaccount:staged", {
            email: email,
            keypair: keypair
          });
        }, self.getErrorDialog(BrowserIDErrors.createAccount));
    },

    validate: function() {
      var email = $("#email").val();
      var pass = $("#password").val();

      return true;
    },

    submit: function() {
      // XXX change this so that we do not authenticate and sync unless we have 
      // both an email and password.
      var email = $("#email").val();
      var pass = $("#password").val();

      var self = this;
      identities.authenticateAndSync(email, pass, 
        function onAuthenticate(authenticated) {
          if (authenticated) {
            self.doWait(BrowserIDWait.authentication);
          }
        },
        function onComplete(authenticated) {
          if (authenticated) {
            self.close("authenticate:authenticated");
          } else {
            //self.find("#cannot_authenticate").hide().fadeIn(400);
          }
        }, 
        self.getErrorDialog(BrowserIDErrors.authentication)
      );
    }
  });

}());
