/*global BrowserID: true, gettext: true*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Errors = (function(){
  "use strict";

  var Errors = {
    authenticate: {
      title: gettext("Authenticating User")
    },

    addEmail: {
      title: gettext("Adding Address")
    },

    addEmailWithAssertion: {
      title: gettext("Adding Primary Email Address to User")
    },

    addressInfo: {
      title: gettext("Checking Address Info")
    },

    authenticateWithAssertion: {
      title: gettext("Authenticating with Assertion")
    },

    cancelUser: {
      title: gettext("Cancelling User Account")
    },

    checkAuthentication: {
      title: gettext("Checking Authentication")
    },

    checkScriptVersion: {
      title: gettext("Checking Script Version")
    },

    completeUserRegistration: {
      title: gettext("Completing User Registration")
    },

    cookiesDisabled: {
      title: gettext("We are sorry, BrowserID requires cookies"),
      message: gettext("BrowserID requires your browser's cookies to be enabled to operate.  Please enable your browser's cookies and try again")
    },

    cookiesEnabled: {
      title: gettext("Checking if Cookies are Enabled")
    },

    createUser: {
      title: gettext("Creating Account")
    },

    getAssertion: {
      title: gettext("Getting Assertion")
    },

    getTokenInfo: {
      title: gettext("Checking Registration Token")
    },

    isEmailRegistered: {
      title: gettext("Checking Email Address")
    },

    isUserAuthenticatedToPrimary: {
      title: gettext("Checking Whether User is Authenticated with IdP")
    },

    logoutUser: {
      title: gettext("Logout Failed")
    },

    offline: {
      title: gettext("You are offline!"),
      message: gettext("Unfortunately, BrowserID cannot communicate while offline!")
    },

    primaryAuthentication: {
      title: gettext("Authenticating with Identity Provider"),
      message: gettext("We had trouble communicating with your email provider, please try again!")
    },

    provisioningPrimary: {
      title: gettext("Provisioning with Identity Provider"),
      message: gettext("We had trouble communicating with your email provider, please try again!")
    },

    provisioningBadPrimary: {
      title: gettext("Provisioning Unsupported Identity Provider"),
      message: gettext("Unfortunately, the email address provided cannot act as a Primary Identity Provider")
    },

    registration: {
      title: gettext("Registration Failed")
    },

    relaySetup: {
      title: gettext("Establishing Relay"),
      message: gettext("Relay frame could not be found")
    },

    requestPasswordReset: {
      title: gettext("Resetting Password")
    },

    removeEmail: {
      title: gettext("Remove Email Address from Account")
    },

    setPassword: {
      title: gettext("Setting Password")
    },

    signIn: {
      title: gettext("Signin Failed")
    },

    signUp: {
      title: gettext("Signup Failed")
    },

    syncAddress: {
      title: gettext("Syncing Address")
    },

    syncEmails: {
      title: gettext("Syncing Email Addresses")
    },

    syncEmailKeypair: {
      title: gettext("Sync Keys for Address")
    },

    tokenInfo: {
      title: gettext("Getting Token Info")
    },

    updatePassword: {
      title: gettext("Updating password")
    },

    verifyEmail: {
      title: gettext("Verifying email address")
    },

    xhrError: {
      title: gettext("Communication Error")
    }

  };


  return Errors;
}());


