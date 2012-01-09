/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
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
BrowserID.Modules.RequiredEmail = (function() {
  "use strict";

  var ANIMATION_TIME = 250,
      bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      helpers = bid.Helpers,
      dialogHelpers = helpers.Dialog,
      dom = bid.DOM,
      assertion,
      cancelEvent = dialogHelpers.cancelEvent,
      email,
      authenticated,
      primaryInfo;

  function closePrimaryUser(callback) {
    this.close("primary_user", _.extend(primaryInfo, {
      email: email,
      requiredEmail: true,
      add: authenticated
    }));

    callback && callback();
  }

  function signIn(callback) {
    var self = this;

    function getAssertion() {
      dialogHelpers.getAssertion.call(self, email, callback);
    }

    if(primaryInfo) {
      // With a primary, just go to the primary flow, it'll be taken care of.
      closePrimaryUser.call(self, callback);
    }
    else if (authenticated) {
      // If the user is already authenticated and they own this address, sign
      // them in.
      getAssertion();
    }
    else {
      // If the user is not already authenticated, but they potentially own
      // this address, try and sign them in and generate an assertion if they
      // get the password right.
      var password = helpers.getAndValidatePassword("#password");
      if (password) {
        dialogHelpers.authenticateUser.call(self, email, password, function(authenticated) {
          if (authenticated) {
            // Now that the user has authenticated, we can get an assertion.
            getAssertion();
          }
          else {
            callback && callback();
          }
        });
      }
    }
  }

  function verifyAddress() {
    // By being in the verifyAddress, we know that the current user  has not
    // been shown the password box and we have to do a verification of some
    // sort.  This will be either an add email to the current account or a new
    // registration.

    var self=this;
    if (authenticated) {
      // If we are veryifying an address and the user is authenticated, it
      // means that the current user does not have control of the address.
      // If the address is registered, it means another account has control of
      // the address and we are consolidating.  If the email is not registered
      // then it means add the address to the current user's account.
      dialogHelpers.addEmail.call(self, email);
    }
    else {
      dialogHelpers.createUser.call(self, email);
    }
  }

  function forgotPassword() {
    var self=this;
    self.close("forgot_password", { email: email, requiredEmail: true });
  }


  function cancel() {
    this.close("cancel");
  }

  var RequiredEmail = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      email = options.email || "",
      authenticated = options.authenticated || false;
      primaryInfo = null;

      function ready() {
        options.ready && options.ready();
      }

      // NOTE: When the app first starts and the user's authentication is
      // checked, all email addresses for authenticated users are synced.  We
      // can be assured by this point that our addresses are up to date.
      if (authenticated) {
        // if the current user owns the required email, sign in with it
        // (without a password). Otherwise, make the user verify the address
        // (which shows no password).
        var emailInfo = user.getStoredEmailKeypair(email);
        if (emailInfo) {
          if(emailInfo.type === "secondary" || emailInfo.cert) {
            // secondary user or cert is valid, user can sign in normally.
            showTemplate({ signin: true });
            ready();
          }
          else {
            // Uh oh, this is a primary user whose certificate is expired,
            // take care of that.
            user.addressInfo(email, function(info) {
              primaryInfo = info;
              if (info.authed) {
                // If the user is authed with the IdP, give them the
                // opportunity to press "signin" before passing them off
                // to the primary user flow
                showTemplate({ signin: true });
              }
              else {
                // User is not authed with IdP, start the verification flow,
                // add address to current user.
                closePrimaryUser.call(self);
              }
              ready();
            }, self.getErrorDialog(errors.addressInfo, ready));
          }
        }
        else {
          // User does not control address, time to verify.
          user.addressInfo(email, function(info) {
            // authenticated user who does not own primary address, make them
            // verify it.
            if(info.type === "primary") {
              primaryInfo = info;
              if (info.authed) {
                // If the user is authed with the IdP, give them the
                // opportunity to press "signin" before passing them off to
                // the primary user flow
                showTemplate({ signin: true });
              }
              else {
                // If user is not authed with IdP, kick them through the
                // primary_user flow to get them verified.
                closePrimaryUser.call(self);
              }
            }
            else {
              showTemplate({ verify: true });
            }
            ready();
          }, self.getErrorDialog(errors.addressInfo, ready));
        }
      }
      else {
        user.addressInfo(email, function(info) {
          if (info.type === "primary") {
            primaryInfo = info;
            if (info.authed) {
              // If the user is authenticated with their IdP, show the
              // sign in button to give the user the chance to abort.
              showTemplate({ signin: true, primary: true });
            }
            else {
              // If the user is not authenticated with their IdP, pass them
              // off to the primary user flow.
              closePrimaryUser.call(self);
            }
          }
          else {
            // If the current email address is registered but the user is not
            // authenticated, make them sign in with it.  Otherwise, make them
            // verify ownership of the address.
            if (info.known) {
              showTemplate({ signin: true, password: true });
            }
            else {
              showTemplate({ verify: true });
            }
          }
          ready();
        }, self.getErrorDialog(errors.addressInfo, ready));
      }

      function showTemplate(options) {
        options = _.extend({
          email: email,
          verify: false,
          signin: false,
          password: false,
          secondary_auth: false,
          primary: false
        }, options);
        self.renderDialog("required_email", options);

        self.bind("#sign_in", "click", cancelEvent(signIn));
        self.bind("#verify_address", "click", cancelEvent(verifyAddress));
        self.bind("#forgotPassword", "click", cancelEvent(forgotPassword));
        self.bind("#cancel", "click", cancelEvent(cancel));
      }

      RequiredEmail.sc.start.call(self, options);
    }

    // BEGIN TEST API
    ,
    signIn: signIn,
    verifyAddress: verifyAddress,
    forgotPassword: forgotPassword,
    cancel: cancel
    // END TEST API
  });

  return RequiredEmail;

}());
