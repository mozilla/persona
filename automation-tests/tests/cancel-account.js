#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

const
path = require('path'),
assert = require('../lib/asserts.js'),
utils = require('../lib/utils.js'),
persona_urls = require('../lib/urls.js'),
CSS = require('../pages/css.js'),
dialog = require('../pages/dialog.js'),
runner = require('../lib/runner.js'),
testSetup = require('../lib/test-setup.js'),
user = require('../lib/user.js');

// pull in test environment, including wd
var browser,
    secondaryEmail,
    secondaryPassword,
    emails;

function setup(done) {
  emails = [];
  user.getVerifiedUser(function(err, info) {
    if (info) {
      browser = info.browser;
      secondaryEmail = saveEmail(info.email);
      secondaryPassword = info.password;
    }
    done(err);
  });
}

function saveEmail(email) {
  emails.push(email);
  return email;
}

function signIn123DoneWithSecondary(browser, email, password, done) {
  browser.chain({onError: done})
    .get(persona_urls['123done'])
    .wclick(CSS['123done.org'].signInButton)
    .wwin(CSS['dialog'].windowName)
    .wtype(CSS['dialog'].emailInput, email)
    .wclick(CSS['dialog'].newEmailNextButton)
    .wtype(CSS['dialog'].existingPassword, password)
    .wclick(CSS['dialog'].returningUserButton)
    .wwin()
    .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
      done(err || assert.equal(text, email));
    });
}

function testUserNotSignedIn123Done(browser, done) {
  browser.chain({onError: done})
    .get(persona_urls['123done'])
    .wfind(CSS['123done.org'].signInButton, done);
}

function testEmailNotRegistered(browser, email, done) {
  browser.chain({onError: done})
    .get(persona_urls['persona'])
    .wclick(CSS['persona.org'].header.signIn)
    .wwin(CSS['dialog'].windowName)
    .wtype(CSS['dialog'].emailInput, email)
    .wclick(CSS['dialog'].newEmailNextButton)
    .wfind(CSS['dialog'].verifyPassword, done);
}

runner.run(module, {
  // from here below tests an explicit cancel

  "test explicit cancel - get a secondary user": function(done) {
    setup(done);
  },

  "setup a browser": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  "log in to 123done using secondaryEmail": function(done) {
    signIn123DoneWithSecondary(browser, secondaryEmail,
      secondaryPassword, done);
  },

  "go to persona manage page and cancel the account": function(done) {
    browser.chain({onError: done})
      .get(persona_urls['persona'])
      .wclick(CSS['persona.org'].cancelAccountLink)
      .delay(500)
      .acceptAlert(function() {
        // the user should now be logged out, look for the sign in button
        browser.wfind(CSS['persona.org'].header.signIn, done);
      });
  },

  "go to 123done, user should no longer be logged in": function(done) {
    testUserNotSignedIn123Done(browser, done);
  },

  "user should now be signed out - cannot sign in with deleted addresses": function(done) {
    testEmailNotRegistered(browser, secondaryEmail, done);
  },

  "shut down remaining browsers": function(done) {
    browser.quit(done);
  }
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});
