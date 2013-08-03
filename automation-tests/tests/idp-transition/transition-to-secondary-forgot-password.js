#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

const
assert = require('../../lib/asserts.js'),
CSS = require('../../pages/css.js'),
path = require('path'),
persona_urls = require('../../lib/urls.js'),
restmail = require('../../lib/restmail.js'),
runner = require('../../lib/runner.js'),
testSetup = require('../../lib/test-setup.js'),
dialog = require('../../pages/dialog.js'),
rp_123done = require('../../pages/123done.js');

var browser, testIdp, primaryToSecondaryUser, secondaryUser;

/**
 * This suite checks the "transition_to_secondary" state flow for an email
 * address. If a Persona account has a password, an address that was a primary
 * is converted to a secondary. The user is expected to see some language
 * that says they no longer enter their IdP password, but instead their Persona
 * password. To complete the state change, the user is forced to enter their
 * Persona password and verify the email address.
 *
 * The basic test flow is:
 * 1) Create an account with a secondary
 * 2) Add a primary address
 * 3) Disable primary support for address in 2
 * 4) Load up dialog, make sure user has to enter Persona password and verify
 * email
 * 5) Verify email, make sure the user is signed in.
 */

runner.run(module, {
  "setup": function(done) {
    testSetup.setup({browsers: 1, testidps: 1, restmails: 1}, function(err, fixtures) {
      if (fixtures) {
        browser = fixtures.browsers[0];
        testIdp = fixtures.testidps[0];
        primaryToSecondaryUser = testIdp.getRandomEmail();
        secondaryUser = fixtures.restmails[0];
      }
      done(err);
    });
  },
  "create a new selenium session": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  "load 123done and open dialog": function(done) {
    browser.chain({onError: done})
           .get(persona_urls["123done"])
           .wclick(CSS['123done.org'].signinButton)
           .wwin(CSS["dialog"].windowName, done);
  },
  "create account with secondary user": function(done) {
    dialog.signInAsNewUser({
      browser: browser,
      email: secondaryUser,
      password: 'password'
    }, done);
  },
  "verify secondary email": function(done) {
    rp_123done.completeEmailVerification({
      browser: browser,
      email: secondaryUser
    }, done);
  },
  "verify we're signed in to 123done": function(done) {
    rp_123done.testSignedInUser({
      browser: browser,
      email: secondaryUser
    }, done);
  },
  "Happy, healthy primary": function(done) {
    testIdp.enableSupport(false, done);
  },
  "re-open dialog to add primary email": function(done) {
    rp_123done.logoutOpenDialog(browser, done);
  },
  "add primary email to account": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['dialog'].useNewEmail)
      .wtype(CSS['dialog'].newEmail, primaryToSecondaryUser)
      .wclick(CSS['dialog'].addNewEmailButton)
      .wwin(done);
  },
  "check primaryToSecondaryUser is logged in": function(done) {
    rp_123done.testSignedInUser({
      browser: browser,
      email: primaryToSecondaryUser
    }, done);
  },
  "The IdP disables support": function(done) {
    testIdp.disableSupport(done);
  },
  "verify user is logged out on page reload - email is in transition state":
      function(done) {
    browser.chain({onError: done})
      .refresh()
      .wfind(CSS['123done.org'].signinButton, done);
  },
  "sign in as primaryToSecondaryUser": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].thisIsNotMe)
      .wtype(CSS['dialog'].emailInput, primaryToSecondaryUser)
      .wclick(CSS['dialog'].newEmailNextButton, done);
  },
  "primaryToSecondaryUser is now in a transition state, user must enter Persona password - user clicks forgot password": function(done) {

    browser.wclick(CSS['dialog'].forgotPassword, done);
  },
  "User completes password reset of converted address, enters new password on main site": function(done) {
    rp_123done.completePasswordReset({
      browser: browser,
      email: primaryToSecondaryUser,
      password: "resetpassword"
    }, done);
  },
  "Check primaryToSecondaryUser is logged in": function(done) {
    rp_123done.testSignedInUser({
      browser: browser,
      email: primaryToSecondaryUser
    }, done);
  },
  "Log user out of 123done to verify they can sign in with password":
      function(done) {
    rp_123done.logoutOpenDialog(browser, done);
  },
  "Sign primaryToSecondaryUser out of dialog to try to sign in with password":
      function(done) {
    browser.wclick(CSS['dialog'].thisIsNotMe, done);
  },
  "Sign primaryToSecondaryUser in with password": function(done) {
    dialog.signInExistingUser({
      browser: browser,
      email: primaryToSecondaryUser,
      password: "resetpassword"
    }, done);
  },
  "Make sure primaryToSecondaryUser is signed in to 123done": function(done) {
    rp_123done.testSignedInUser({
      browser: browser,
      email: primaryToSecondaryUser
    }, done);
  }
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});

