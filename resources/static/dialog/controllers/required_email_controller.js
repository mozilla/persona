/*jshint brgwser:true, jQuery: true, forin: true, laxbreak:true */
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
(function() {
  "use strict";

  var ANIMATION_TIME = 250,
      bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      helpers = bid.Helpers,
      dialogHelpers = helpers.Dialog,
      dom = bid.DOM,
      assertion;

  function signIn(event) {
    event && event.preventDefault();

    var self = this,
        email = self.email;

    // If the user is already authenticated and they own this address, sign 
    // them right in.
    if(self.authenticated) {
      dialogHelpers.getAssertion.call(self, email);
    }
    else {
      // If the user is not already authenticated, but they potentially own 
      // this address, try and sign them in and generate an assertion if they 
      // get the password right.
      var password = helpers.getAndValidatePassword("#password");
      if (password) {
        dialogHelpers.authenticateUser.call(self, email, password, function(authenticated) {
          if (authenticated) {
            // Now that the user has authenticated, sync their emails and get an 
            // assertion for the email we care about.
            user.syncEmailKeypair(email, function() {
              dialogHelpers.getAssertion.call(self, email);
            }, self.getErrorDialog(errors.syncEmailKeypair));
          }
        });
      }
    }
  }

  function verifyAddress(event) {
    // By being in the verifyAddress, we know that the current user  has not 
    // been shown the password box and we have to do a verification of some 
    // sort.  This will be either an add email to the current account or a new 
    // registration.  
    
    event && event.preventDefault();

    var self=this;
    if(self.authenticated) {
      // If we are veryifying an address and the user is authenticated, it 
      // means that the current user does not have control of the address.
      // If the address is registered, it means another account has control of 
      // the address and we are consolidating.  If the email is not registered 
      // then it means add the address to the current user's account.
      dialogHelpers.addEmail.call(self, self.email);
    }
    else {
      dialogHelpers.createUser.call(self, self.email);
    }
  }

  function forgotPassword(event) {
    event && event.preventDefault();

    var self=this;
    self.close("forgot_password", { email: self.email });
  }


  function cancel(event) {
    event && event.preventDefault();

    this.close("cancel");
  }

  PageController.extend("Requiredemail", {}, {
    start: function(options) {
      var self=this,
          email = options.email || "",
          authenticated = options.authenticated || false;

      self.email = email;
      self.authenticated = authenticated;

      // NOTE: When the app first starts and the user's authentication is 
      // checked, all email addresses for authenticated users are synced.  We 
      // can be assured by this point that our addresses are up to date.
      if(authenticated) {
        // if the current user owns the required email, sign in with it 
        // (without a password). Otherwise, make the user verify the address
        // (which shows no password).
        var userOwnsEmail = !!user.getStoredEmailKeypair(email);
        showTemplate(userOwnsEmail, false);
      }
      else {
        user.isEmailRegistered(email, function(registered) {
          // If the current email address is registered but the user is not 
          // authenticated, make them sign in with it.  Otherwise, make them 
          // verify ownership of the address.
          showTemplate(registered, registered);
        }, self.getErrorDialog(errors.isEmailRegistered));
      }

      function showTemplate(requireSignin, showPassword) {
        self.renderDialog("requiredemail", {
          email: email,
          signin: requireSignin,
          showPassword: showPassword
        });

        self.bind("#sign_in", "click", signIn);
        self.bind("#verify_address", "click", verifyAddress);
        self.bind("#forgotPassword", "click", forgotPassword);
        self.bind("#cancel", "click", cancel);
      }

      self._super();
    },

    signIn: signIn,
    verifyAddress: verifyAddress,
    forgotPassword: forgotPassword,
    cancel: cancel
  });

}());
