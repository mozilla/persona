#!/usr/bin/env node
/*jshint sub:true */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
assert = require('../lib/asserts.js'),
utils = require('../lib/utils.js'),
persona_urls = require('../lib/urls.js'),
CSS = require('../pages/css.js'),
dialog = require('../pages/dialog.js'),
runner = require('../lib/runner.js'),
testSetup = require('../lib/test-setup.js'),
user = require('../lib/user.js'),
timeouts = require('../lib/timeouts.js');

var browser,
    testIdp,
    primaryEmail,
    secondPrimaryEmail;

runner.run(module, {
  "setup all the things": function(done) {
    testSetup.setup({ b:1, testidps:1 }, function(err, fix) {
      if (fix) {
        browser = fix.b[0];
        testIdp = fix.testidps[0];
        primaryEmail = testIdp.getRandomEmail();
        secondPrimaryEmail = testIdp.getRandomEmail();
      }
      done(err);
    });
  },

  "enable primary support": function(done) {
    testIdp.enableSupport(done);
  },

  //XXX figure out how to parameterize the RP
  "start the session": function(done) {
    testSetup.newBrowserSession(browser, done);
  },

  //XXX obviously in need of refactoring between this primary and the second one.
  "signup a new account with a primary": function(done) {
    browser.chain({onError: done})
      .get(persona_urls["123done"])
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wtype(CSS['dialog'].emailInput, primaryEmail)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wclick(CSS['testidp.org'].loginButton)
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, primaryEmail));
      });
  },
  "add a primary email to the account": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].useNewEmail)
      .wtype(CSS['dialog'].newEmail, secondPrimaryEmail)
      .wclick(CSS['dialog'].addNewEmailButton)
      .wclick(CSS['testidp.org'].loginButton)
      .wclickIfExists(CSS['dialog'].notMyComputerButton)
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, secondPrimaryEmail));
      });
  },
  //XXX This could be much more comprehensive by bringing up the dialog
  // again and checking the listed users, etc.
  "shut down remaining browsers": function(done) {
    browser.quit(done);
  }
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});
