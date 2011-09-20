/*jshint brgwser:true, jQuery: true, forin: true, laxbreak:true */                                             
/*global Channel:true, CryptoStubs:true, alert:true, errorOut:true, setupChannel:true, getEmails:true, clearEmails: true, console: true, _: true, pollTimeout: true, addEmail: true, removeEmail:true, BrowserIDNetwork: true, BrowserIDWait:true, BrowserIDErrors: true, PageController: true, OpenAjax: true */ 
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

//
// a JMVC controller for the browserid dialog
//

(function() {
"use strict";

PageController.extend("Dialog", {}, {
    init: function(el) {
      var html = $.View("//dialog/views/body.ejs", {});
      this.element.html(html);
      this.element.show();

      // keep track of where we are and what we do on success and error
      this.onsuccess = null;
      this.onerror = null;
      var chan = setupChannel(this);
      this.stateMachine();
    },
      
    getVerifiedEmail: function(origin_url, onsuccess, onerror) {
      this.onsuccess = onsuccess;
      this.onerror = onerror;

      BrowserIDNetwork.setOrigin(origin_url);

      this.doStart();

      var self=this;
      $(window).bind("unload", function() {
        self.doCancel();
      });
    },


    stateMachine: function() {
      var self=this, hub = OpenAjax.hub, el = this.element;

      hub.subscribe("createaccount:staged", function(msg, info) {
        self.doConfirmEmail(info.email);
      });

/*      hub.subscribe("createaccount:signin", function() {
        self.doAuthenticate();
      });
*/
      hub.subscribe("authenticate:authenticated", function() {
        self.syncIdentities();
      });

/*      hub.subscribe("authenticate:createuser", function() {
        self.doCreate();
      });
*/
      hub.subscribe("authenticate:forgotpassword", function() {
        self.doForgotPassword();
      });

      hub.subscribe("checkregistration:confirmed", function() {
        self.doRegistrationConfirmed();
      });

      /*
      hub.subscribe("checkregistration:complete", function() {
        self.doSignIn();
      });
*/
      hub.subscribe("pickemail:complete", function(msg, info) {
        self.doEmailSelected(info.email);
      });

      hub.subscribe("pickemail:addemail", function() {
        self.doAddEmail();
      });

      hub.subscribe("pickemail:notme", function() {
        self.doNotMe();
      });

      hub.subscribe("addemail:complete", function(msg, info) {
        self.doConfirmEmail(info.email);
      });

      hub.subscribe("start", function() {
        self.doStart();
      });

      hub.subscribe("cancel", function() {
        self.doCancel();
      });

    },

    doStart: function() {
      // we should always check to see whether we're authenticated
      // at dialog start. issue #74.
      //
      // (lth) XXX: we could include both csrf token and auth status
      // in the intial resource serving to reduce network requests.
      this.doCheckAuth();
    },
      
    doCancel: function() {
      var self=this;
      if(self.onsuccess) {
        self.onsuccess(null);
      }
    },

    doSignIn: function() {
      this.element.pickemail();
    },

    doAuthenticate: function() {
      this.element.authenticate();
    },

    doCreate: function() {
      //this.element.createaccount();
    },
      
    doForgotPassword: function() {
      this.element.forgotpassword();
    },

    doAddEmail: function() {
      this.element.addemail();
    },

    doConfirmEmail: function(email) {
      this.confirmEmail = email;

      this.element.checkregistration({email: email});
    },

    doRegistrationConfirmed: function() {
        var self = this;
        self.element.setpassword({ email: self.confirmEmail });
    /*    BrowserIDIdentities.confirmIdentity(self.confirmEmail,
          self.doSignIn.bind(self));
      */
    },

    doEmailSelected: function(email) {
      var self=this;
      // yay!  now we need to produce an assertion.
      BrowserIDIdentities.getIdentityAssertion(email, function(assertion) {
        // Clear onerror before the call to onsuccess - the code to onsuccess 
        // calls window.close, which would trigger the onerror callback if we 
        // tried this afterwards.
        self.onerror = null;
        self.onsuccess(assertion);
      });
    },

    doNotMe: function() {
      clearEmails();
      BrowserIDNetwork.logout(this.doAuthenticate.bind(this));
    },

    syncIdentities: function() {
      var self = this;
      BrowserIDIdentities.syncIdentities(self.doSignIn.bind(self), 
        self.getErrorDialog(BrowserIDErrors.signIn));
    },


    doCheckAuth: function() {
      this.doWait(BrowserIDWait.checkAuth);
      var self=this;
      BrowserIDIdentities.checkAuthenticationAndSync(function onSuccess() {}, 
      function onComplete(authenticated) {
        if (authenticated) {
          self.doSignIn();
        } else {
          self.doAuthenticate();
        }
      }, self.getErrorDialog(BrowserIDErrors.checkAuthentication));
  }

  });


}());
