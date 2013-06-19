#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
assert = require('../../lib/asserts.js'),
CSS = require('../../pages/css.js'),
path = require('path'),
persona_urls = require('../../lib/urls.js'),
restmail = require('../../lib/restmail.js'),
runner = require('../../lib/runner.js'),
testSetup = require('../../lib/test-setup.js'),
dialog = require('../../pages/dialog.js');

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
           .wwin(CSS["persona.org"].windowName, done);
  },
  "create account with secondary user": function(done) {
    dialog.signInAsNewUser({
      browser: browser,
      email: secondaryUser,
      password: 'password'
    }, done);
  },
  "verify secondary email": function(done) {
    completeEmailVerification(secondaryUser, done);
  },
  "verify we're signed in to 123done": function(done) {
    testSignedInUser(secondaryUser, done);
  },
  "Happy, healthy primary": function(done) {
    testIdp.enableSupport(false, done);
  },
  "add primary email to account": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].useNewEmail)
      .wtype(CSS['dialog'].newEmail, primaryToSecondaryUser)
      .wclick(CSS['dialog'].addNewEmailButton)
      .wwin(done);
  },
  "check primaryToSecondaryUser is logged in": function(done) {
    testSignedInUser(primaryToSecondaryUser, done);
  },
  "Authed user logs out, reopen dialog, sign user out": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].thisIsNotMe, done);
  },
  "The IdP disables support": function(done) {
    testIdp.disableSupport(done);
  },
  "try to sign in as primaryToSecondaryUser":
      function(done) {
    browser.chain({onError: done})
      .wtype(CSS['dialog'].emailInput, primaryToSecondaryUser)
      .wclick(CSS['dialog'].newEmailNextButton, done);
  },
  "primaryToSecondaryUser is now in a transition state, user must enter Persona password and verify email address": function(done) {

    browser.chain({onError: done})
      .wtype(CSS['dialog'].existingPassword, "password")
      .wclick(CSS['dialog'].returningUserButton)
      .wfind(CSS['dialog'].confirmAddressScreen, done);
  },
  "User verifies ownership of previous primary address": function(done) {
    completeEmailVerification(primaryToSecondaryUser, done);
  },
  "Check primaryToSecondaryUser is logged in": function(done) {
    testSignedInUser(primaryToSecondaryUser, done);
  }
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});

function completeEmailVerification(email, done) {
  var verifyWindow = 'verifyWindow1';
  restmail.getVerificationLink(email, function(err, token, verificationURL) {
    browser.chain({onError: done})
        .newWindow(verificationURL, verifyWindow)
        .wwin(verifyWindow)
        .waitForDisplayed({which: CSS['123done.org'].logoutLink})
        .close()
        .wwin(done);
  });
}

function testSignedInUser(email, done) {
  browser.wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
    done(err || assert.equal(text, email));
  });
}
