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
NEW_PASSWORD = "password";

// pull in test environment, including wd
var browser, secondBrowser, theEmail;
// this is the more compact setup syntax
testSetup.setup({b:2, r:1}, function(err, fix) {
  browser = fix.b[0];
  secondBrowser = fix.b[1];
  theEmail = fix.r[0];
});

vowsHarness({
  "startup, go to 123done, click sign in": function(done) {
    browser.chain()
      .newSession(testSetup.sessionOpts)
      .get(persona_urls['123done'])
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS['persona.org'].windowName, done);
  },
  "go through signup flow": function(done) {
    dialog.signInAsNewUser({
      browser: browser,
      email: theEmail,
      password: theEmail.split('@')[0]
    }, function() {
      browser.quit();
      done();
    });
  },

  "get verification link from email": function(done) {
    restmail.getVerificationLink({ email: theEmail, index: 0 }, done);
  },

  "get another browser session, open verification link in new browser window": function(done, link) {
    secondBrowser.chain()
      .newSession(testSetup.sessionOpts)
      .get(link)
      .wtype(CSS['persona.org'].signInForm.password, theEmail.split('@')[0])
      .wclick(CSS['persona.org'].signInForm.finishButton)
      .wfind(CSS['persona.org'].congratsMessage)
      .quit(function() {
        done();
      });
  },

  "open myfavoritebeer": function(done) {
    browser.chain()
      .newSession(testSetup.sessionOpts)
      .get(persona_urls['myfavoritebeer'])
      .wclick(CSS['myfavoritebeer.org'].signinButton)
      .wwin(CSS['dialog'].windowName, done);
  },

  "enter email address, click forgotPassword": function(done) {
    browser.chain()
      .wtype(CSS['dialog'].emailInput, theEmail)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wclick(CSS['dialog'].forgotPassword, done);
  },

  "choose new password": function(done) {
    browser.chain()
      .wtype(CSS['dialog'].choosePassword, NEW_PASSWORD)
      .wtype(CSS['dialog'].verifyPassword, NEW_PASSWORD)
      .wclick(CSS['dialog'].resetPasswordButton, function() {
        done();
      });
  },

  "get reset verification link from email": function(done) {
    restmail.getVerificationLink({ email: theEmail, index: 1 }, done);
  },

  "get another browser session, open reset verification link in new browser window": function(done, link) {
    secondBrowser.chain()
      .newSession(testSetup.sessionOpts)
      .get(link)
      .wtype(CSS['persona.org'].signInForm.password, NEW_PASSWORD)
      .wclick(CSS['persona.org'].signInForm.finishButton)
      .wfind(CSS['persona.org'].congratsMessage)
      .quit(function() {
        done();
      });
  },

  "make sure user is signed in to RP after password reset": function(done) {
    browser.chain()
      .wwin()
      .wtext(CSS['myfavoritebeer.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, theEmail);
        done();
      });
  },

  "shut down remaining browsers": function(done) {
    browser.quit();
    done();
  }
}, module);
