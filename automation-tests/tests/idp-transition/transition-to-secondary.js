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
testSetup = require('../../lib/test-setup.js');

var browser, testIdp, primaryToSecondaryUser, secondaryUser;

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
  "load 123done and wait for the signin button to be visible": function(done) {
    browser.get(persona_urls["123done"], done);
  },
  "click the signin button": function(done) {
    browser.wclick(CSS['123done.org'].signinButton, done);
  },
  "switch to the dialog when it opens": function(done) {
    browser.wwin(CSS["persona.org"].windowName, done);
  },
  "Happy, healthy primary": function(done) {
    testIdp.enableSupport(false, done);
  },
  "Sign in": function(done) {
    browser.chain({onError: done})
      .wtype(CSS['dialog'].emailInput, primaryToSecondaryUser)
      .wclick(CSS['dialog'].newEmailNextButton, done);
  },
  "verify we're signed in to 123done": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, primaryToSecondaryUser));
       });
  },
  "add secondary email to account": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].useNewEmail)
      .wtype(CSS['dialog'].newEmail, secondaryUser)
      .wclick(CSS['dialog'].addNewEmailButton)
      .wtype(CSS['dialog'].choosePassword, 'password')
      .wtype(CSS['dialog'].verifyPassword, 'password')
      .wclick(CSS['dialog'].createUserButton, done);
  },
  "Verify secondary email": function(done) {
    var verifyWindow = 'verifyWindow1';
    restmail.getVerificationLink(secondaryUser, function(err, token, verificationURL) {
      browser.chain({onError: done})
          .newWindow(verificationURL, verifyWindow)
          .wwin(verifyWindow)
          .waitForDisplayed({which: CSS['123done.org'].logoutLink})
          .close()
          .wwin(done);
    });
  },
  "Check secondaryUser is logged in": function(done) {
      browser.wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, secondaryUser));
      });
  },
  "The IdP disables support": function(done) {
    testIdp.disableSupport(done);
  },
  "Authed user logs out, reopen dialog, sign user out": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].thisIsNotMe, done);
  },
  "sign in as primaryToSecondaryUser - address is now a secondary":
      function(done) {
    browser.chain({onError: done})
      .wtype(CSS['dialog'].emailInput, primaryToSecondaryUser)
      .wclick(CSS['dialog'].newEmailNextButton, done);
  },
  "address is now in a transition state, user must enter Persona password and verify their email address": function(done) {

    browser.chain({onError: done})
      .wtype(CSS['dialog'].existingPassword, "password")
      .wclick(CSS['dialog'].returningUserButton)
      .wfind(CSS['dialog'].confirmAddressScreen, done);
  },
  "User verifies ownership of previous primary address": function(done) {
    var verifyWindow = 'verifyWindow1';
    restmail.getVerificationLink(primaryToSecondaryUser, function(err, token, verificationURL) {
      browser.chain({onError: done})
          .newWindow(verificationURL, verifyWindow)
          .wwin(verifyWindow)
          .waitForDisplayed({which: CSS['123done.org'].logoutLink})
          .close()
          .wwin(done);
    });
  },
  "Check primaryToSecondaryUser is logged in": function(done) {
      browser.wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, primaryToSecondaryUser));
      });
  },
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});
