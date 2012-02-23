/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
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
      email,
      auth_level,
      primaryInfo,
      secondaryAuth;

  function closePrimaryUser(callback) {
    this.close("primary_user", _.extend(primaryInfo, {
      email: email,
      requiredEmail: true,
      add: !!auth_level
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
    else if (auth_level === "password") {
      // this is a secondary address and the user is authenticated with their
      // password, sign them in.
      getAssertion();
    }
    else {
      // this is a secondary address, but the user is either not authenticated
      // or they are only authenticated at the assertion level.  If their
      // password is correct, sign them in and get an assertion.
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
    // By being in the verifyAddress, we know that the current user has not
    // been shown the password box and we have to do a verification of some
    // sort.  This will be either an add email to the current account or a new
    // registration.

    var self=this;
    if (auth_level) {
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
    this.close(secondaryAuth ? "cancel_state" : "cancel");
  }

  var RequiredEmail = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      email = options.email || "";
      secondaryAuth = options.secondary_auth;
      primaryInfo = null;

      function ready() {
        options.ready && options.ready();
      }

      user.checkAuthentication(function(checked_auth_level) {
        auth_level = checked_auth_level;

        // NOTE: When the app first starts and the user's authentication is
        // checked, all email addresses for authenticated users are synced.  We
        // can be assured by this point that our addresses are up to date.  If
        // the user is not authenticated, all addresses are wiped, meaning
        // a user could not be looking at stale data and/or authenticate as
        // somebody else.
        var emailInfo = user.getStoredEmailKeypair(email);
        if(emailInfo && emailInfo.type === "secondary") {
          // secondary user, show the password field if they are not
          // authenticated to the "password" level.
          showTemplate({
            signin: true,
            password: auth_level !== "password",
            secondary_auth: secondaryAuth
          });
          ready();
        }
        else if(emailInfo && emailInfo.cert) {
          // primary user with valid cert, user can sign in normally.
          primaryInfo = emailInfo;
          showTemplate({ signin: true, primary: true });
          ready();
        }
        else {
          // At this point, there are several possibilities:
          // 1) Authenticated primary user who has valid cert.
          // 2) Authenticated primary user who has an expired cert.
          // 3) Authenticated user who does not control address.
          // 4) Unauthenticated user.
          user.addressInfo(email, function(info) {
            if(info.type === "primary") primaryInfo = info;

            if (info.authed) {
              // this is a primary user who is authenticated with their IdP.
              // We know the user has control of this address, give them
              // a chance to hit "sign in" before we kick them off to the
              // primary flow account.
              showTemplate({ signin: true, primary: true });
            }
            else if(emailInfo || info.type === "primary") {
              // If there is emailInfo, this is a primary user who has
              // control of the address, but whose cert is expired and the user
              // is not authenticated with their IdP.
              // OR
              // User who does not control a primary address.
              closePrimaryUser.call(self);
            } else if(auth_level || !info.known) {
              // user is authenticated, but does not control address
              // OR
              // address is unknown, make the user verify.
              showTemplate({ verify: true });
            }
            else {
              // We've made it all this way.  It is a user who is not logged in
              // at all and the address is known.  Make the user log in.
              showTemplate({ signin: true, password: true });
            }
            ready();
          }, self.getErrorDialog(errors.addressInfo, ready));
        }
      }, self.getErrorDialog(errors.checkAuthentication, ready));

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

        self.click("#sign_in", signIn);
        self.click("#verify_address", verifyAddress);
        self.click("#forgotPassword", forgotPassword);
        self.click("#cancel", cancel);
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
