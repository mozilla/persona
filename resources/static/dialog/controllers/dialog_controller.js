/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global setupChannel:true, BrowserID: true, PageController: true, OpenAjax: true */
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

  var bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      dom = bid.DOM,
      offline = false,
      win = window,
      subscriptions = [],
      hub = OpenAjax.hub;

  function subscribe(message, cb) {
     subscriptions.push(hub.subscribe(message, cb));
  }

  function createCheckRegistrationController(email, verifier, message) {
    this.confirmEmail = email;

    var controller = this.element.checkregistration({
      email: email,
      verifier: verifier,
      verificationMessage: message
    }).controller("checkregistration");  // specify the name of the controller
                                         // or else the dialog controller is returned.
    controller.startCheck();
  }

  PageController.extend("Dialog", {}, {
      init: function(el, options) {
        offline = false;

        options = options || {};

        if (options.window) {
          win = options.window;
        }

        var self=this;

        self.domEvents = [];
        self._super();

        // keep track of where we are and what we do on success and error
        self.onsuccess = null;
        self.onerror = null;

        try {
          win.setupChannel(self);
          self.stateMachine();
        } catch (e) {
          self.renderError("error", {
            action: errors.relaySetup
          });
        }
      },

      destroy: function() {
        var subscription;

        while(subscription = subscriptions.pop()) {
          hub.unsubscribe(subscription);
        }

        this._super();
      },

      getVerifiedEmail: function(origin_url, onsuccess, onerror) {
        return this.get(origin_url, {}, onsuccess, onerror);
      },

      get: function(origin_url, params, onsuccess, onerror) {
        var self=this;
        self.onsuccess = onsuccess;
        self.onerror = onerror;

        if (typeof(params) == 'undefined') {
          params = {};
        }

        self.allowPersistent = !!params.allowPersistent;
        self.requiredEmail = params.requiredEmail;

        if ('onLine' in navigator && !navigator.onLine) {
          self.doOffline();
          return;
        }

        user.setOrigin(origin_url);
        dom.setInner("#sitename", user.getHostname());

        self.doCheckAuth();

        self.bind(win, "unload", function() {
          // do this only if something else hasn't
          // declared success
          if (!self.success) {
            bid.Storage.setStagedOnBehalfOf("");
            self.doCancel();
          }
          window.teardownChannel();
        });
      },


      stateMachine: function() {
        var self=this,
            el = this.element;

        subscribe("offline", function(msg, info) {
          self.doOffline();
        });

        subscribe("xhrError", function(msg, info) {
          //self.doXHRError(info);
          // XXX how are we going to handle this?
        });

        subscribe("user_staged", function(msg, info) {
          self.doConfirmUser(info.email);
        });

        subscribe("user_confirmed", function() {
          self.doEmailConfirmed();
        });

        subscribe("cancel_user_confirmed", function() {
          user.cancelUserValidation();
          self.returnFromStageCancel();
        });

        subscribe("authenticated", function(msg, info) {
          //self.doEmailSelected(info.email);
          // XXX benadida, lloyd - swap these two if you want to experiment with
          // generating assertions directly from signin.
          self.syncEmails();
        });

        subscribe("forgot_password", function(msg, info) {
          self.doForgotPassword(info.email);
        });

        subscribe("cancel_forgot_password", function(msg, info) {
          user.cancelUserValidation();
          self.returnFromStageCancel();
        });

        subscribe("reset_password", function(msg, info) {
          self.doConfirmUser(info.email);
        });

        subscribe("assertion_generated", function(msg, info) {
          if (info.assertion !== null) {
            self.doAssertionGenerated(info.assertion);
          }
          else {
            self.doPickEmail();
          }
        });

        subscribe("add_email", function(msg, info) {
          self.doAddEmail();
        });

        subscribe("cancel_add_email", function(msg, info) {
          self.doPickEmail();
        });

        subscribe("email_staged", function(msg, info) {
          self.doConfirmEmail(info.email);
        });

        subscribe("email_confirmed", function() {
          self.doEmailConfirmed();
        });

        subscribe("cancel_email_confirmed", function() {
          user.cancelEmailValidation();
          self.returnFromStageCancel();
        });

        subscribe("notme", function() {
          self.doNotMe();
        });

        subscribe("auth", function(msg, info) {
          info = info || {};

          self.doAuthenticate({
            email: info.email
          });
        });

        subscribe("start", function() {
          self.doCheckAuth();
        });

        subscribe("cancel", function() {
          self.doCancel();
        });

      },

      doOffline: function() {
        this.renderError("offline", {});
        offline = true;
      },

      doXHRError: function(info) {
        if (!offline) {
          this.renderError("error", $.extend({
            action: errors.xhrError
          }, info));
        }
      },

      doConfirmUser: function(email) {
        createCheckRegistrationController.call(this, email, "waitForUserValidation", "user_confirmed");
      },

      doCancel: function() {
        var self=this;
        if (self.onsuccess) {
          self.onsuccess(null);
        }
      },

      doPickEmail: function() {
        var self=this;
        self.returnFromStageCancel = self.doPickEmail.bind(self);
        self.element.pickemail({
          // XXX ideal is to get rid of this and have a User function
          // that takes care of getting email addresses AND the last used email
          // for this site.
          origin: user.getHostname(),
          allow_persistent: self.allowPersistent
        });
      },

      doAddEmail: function() {
        this.element.addemail({});
      },

      doAuthenticate: function(info) {
        var self = this;

        // Save this off in case the user forgets their password or goes to add 
        // a new password but has to cancel.
        self.returnFromStageCancel = self.doAuthenticate.bind(self, info);
        self.element.authenticate(info);
      },

      doAuthenticateWithRequiredEmail: function(info) {
        var self=this;
        self.returnFromStageCancel = self.doAuthenticateWithRequiredEmail.bind(self, info);
        self.element.requiredemail(info);
      },

      doForgotPassword: function(email) {
        this.element.forgotpassword({
          email: email
        });
      },

      doConfirmEmail: function(email) {
        createCheckRegistrationController.call(this, email, "waitForEmailValidation", "email_confirmed");
      },

      doEmailConfirmed: function() {
        var self=this;
        // yay!  now we need to produce an assertion.
        user.getAssertion(this.confirmEmail, self.doAssertionGenerated.bind(self),
          self.getErrorDialog(errors.getAssertion));
      },

      doAssertionGenerated: function(assertion) {
        var self=this;
        // Clear onerror before the call to onsuccess - the code to onsuccess
        // calls window.close, which would trigger the onerror callback if we
        // tried this afterwards.
        self.onerror = null;
        self.success = true;
        self.onsuccess(assertion);
      },

      doNotMe: function() {
        var self=this;
        user.logoutUser(self.doAuthenticate.bind(self), self.getErrorDialog(errors.logoutUser));
      },

      syncEmails: function() {
        var self = this;
        user.syncEmails(self.doPickEmail.bind(self),
          self.getErrorDialog(errors.signIn));
      },

      doCheckAuth: function() {
        var self=this;
        user.checkAuthenticationAndSync(function onSuccess() {},
          function onComplete(authenticated) {
            if (self.requiredEmail) {
              self.doAuthenticateWithRequiredEmail({
                email: self.requiredEmail,
                authenticated: authenticated
              });
            }
            else if (authenticated) {
              self.doPickEmail();
            } else {
              self.doAuthenticate();
            }
          }, self.getErrorDialog(errors.checkAuthentication));
    }

  });


}());
