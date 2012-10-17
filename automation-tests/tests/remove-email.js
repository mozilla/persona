#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
assert = require('assert'),
restmail = require('../lib/restmail.js'),
utils = require('../lib/utils.js'),
persona_urls = require('../lib/urls.js'),
CSS = require('../pages/css.js'),
dialog = require('../pages/dialog.js'),
vowsHarness = require('../lib/vows_harness.js'),
testSetup = require('../lib/test-setup.js'),
user = require('../lib/user.js');

// pull in test environment, including wd
var browser,
    secondBrowser,
    firstPrimaryEmail,
    firstPrimaryPassword,
    secondPrimaryEmail,
    secondPrimaryPassword,
    secondaryEmail,
    secondaryPassword;

function getEmailIndex(email) {
  var emails = [firstPrimaryEmail, secondPrimaryEmail, secondaryEmail];
  var sortedEmails = emails.sort(function(a, b) { return a === b ? 0 : a > b ? 1 : -1; });
  var index = sortedEmails.indexOf(email);
  return index;
}

// this is the more compact setup syntax
testSetup.setup({b:2, r:1, e:2}, function(err, fix) {
  browser = fix.b[0];
  secondBrowser = fix.b[1];
  firstPrimaryEmail = fix.e[0];
  secondPrimaryEmail = fix.e[1];
  secondaryEmail = fix.r[0];
  firstPrimaryPassword = firstPrimaryEmail.split('@')[0];
  secondPrimaryPassword = secondPrimaryEmail.split('@')[0];
  secondaryPassword = secondaryEmail.split('@')[0];
});

vowsHarness({
  "go to 123done and create a primary account": function(done) {
    browser.chain()
      .newSession(testSetup.sessionOpts)
      .get(persona_urls['123done'])
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wtype(CSS['dialog'].emailInput, firstPrimaryEmail)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      // sometimes the verifyWithPrimaryButton needs clicked twice
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      .wtype(CSS['eyedee.me'].newPassword, firstPrimaryPassword)
      .wclick(CSS['eyedee.me'].createAccountButton)
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, firstPrimaryEmail);
        done();
      });
  },

  "add another primary to account": function(done) {
    browser.chain()
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].useNewEmail)
      .wtype(CSS['dialog'].newEmail, secondPrimaryEmail)
      .wclick(CSS['dialog'].addNewEmailButton)
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      // sometimes the verifyWithPrimaryButton needs clicked twice
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      .wtype(CSS['eyedee.me'].newPassword, secondPrimaryPassword)
      .wclick(CSS['eyedee.me'].createAccountButton)
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, secondPrimaryEmail);
        done();
      });
  },

  "add secondary to account": function(done) {
    browser.chain()
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].useNewEmail)
      .wtype(CSS['dialog'].newEmail, secondaryEmail)
      .wclick(CSS['dialog'].addNewEmailButton)
      .wtype(CSS['dialog'].choosePassword, secondaryPassword)
      .wtype(CSS['dialog'].verifyPassword, secondaryPassword)
      .wclick(CSS['dialog'].createUserButton, done)
  },

  "get verification link": function(done) {
    restmail.getVerificationLink({ email: secondaryEmail }, done);
  },

  "follow link, wait for redirect, secondary should be displayed": function(done, link) {
    browser.chain()
      .wwin()
      .get(link)
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, secondaryEmail);
        done();
      });
  },

  "log in to 123done using secondPrimaryEmail": function(done) {
    browser.chain()
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].emailPrefix + getEmailIndex(secondPrimaryEmail))
      .wclick(CSS['dialog'].signInButton)
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, secondPrimaryEmail);
        done();
      });
  },

  "log in to myfavoritebeer using secondaryEmail": function(done) {
    browser.chain()
      .get(persona_urls['myfavoritebeer'])
      .wclick(CSS['myfavoritebeer.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].emailPrefix + getEmailIndex(secondaryEmail))
      .wclick(CSS['dialog'].signInButton)
      .wwin()
      .wtext(CSS['myfavoritebeer.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, secondaryEmail);
        done();
      });
  },

  "go to main site, remove secondPrimaryEmail": function(done) {
    browser.chain()
      .get(persona_urls['persona'])
      .wclick(CSS['persona.org'].emailListEditButton)
      // a bit janktastic. Get all of the delete buttons. Find the right one.
      // Click it.
      .elementsByCssSelector(CSS['persona.org'].removeEmailButton, function(err, elements) {
        var button = elements[getEmailIndex(secondPrimaryEmail)];

        browser.chain()
          .clickElement(button)
          // Give Chrome a bit to display the alert or else the comment to
          // accept the alert is fired too early.
          .delay(500)
          .acceptAlert()
          .wclick(CSS['persona.org'].emailListDoneButton, done);
      });
  },

  "go to 123done, user should no longer be logged in": function(done) {
    browser.chain()
      .get(persona_urls['123done'])
      .waitForDisplayed(CSS['123done.org'].signInButton, done);
  },

  "go to main site, remove secondaryEmail": function(done) {
    browser.chain()
      .get(persona_urls['persona'])
      .wclick(CSS['persona.org'].emailListEditButton)
      .elementsByCssSelector(CSS['persona.org'].removeEmailButton, function(err, elements) {
        var button = elements[getEmailIndex(secondaryEmail)];

        browser.chain()
          .clickElement(button)
          // Give Chrome a bit to display the alert or else the comment to
          // accept the alert is fired too early.
          .delay(500)
          .acceptAlert()
          .wclick(CSS['persona.org'].emailListDoneButton, done);
      });
  },

  "go to myfavoritebeer, make sure user is no longer signed in": function(done) {
    browser.chain()
      .get(persona_urls['myfavoritebeer'])
      .waitForDisplayed(CSS['myfavoritebeer.org'].signInButton, done);
  },

  "shut down remaining browsers": function(done) {
    browser.quit();
    secondBrowser.quit();
    done();
  }
}, module);
