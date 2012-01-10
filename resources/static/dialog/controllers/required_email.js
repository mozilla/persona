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
      cancelEvent = dialogHelpers.cancelEvent,
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

      email = options.email || "",
      secondaryAuth = options.secondary_auth;

      function ready() {
        options.ready && options.ready();
      }

      user.checkAuthentication(function(checked_auth_level) {
        auth_level = checked_auth_level;
        primaryInfo = null;

        // NOTE: When the app first starts and the user's authentication is
        // checked, all email addresses for authenticated users are synced.  We
        // can be assured by this point that our addresses are up to date.
        if (auth_level) {
          // if the current user owns the required email, sign in with it
          // (without a password). Otherwise, make the user verify the address
          // (which shows no password).
          var emailInfo = user.getStoredEmailKeypair(email);
          if (emailInfo) {
            if(emailInfo.type === "secondary") {
              // secondary user, show the password field if they are not
              // authenticated to the "password" level.
              showTemplate({
                signin: true,
                password: auth_level !== "password",
                secondary_auth: secondaryAuth
              });
              ready();
            }
            else if(emailInfo.cert) {
              // primary user with valid cert, user can sign in normally.
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
