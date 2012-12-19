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
    primaryEmail,
    secondPrimaryEmail;

runner.run(module, {
  "setup all the things": function(done) {
    testSetup.setup({ b:1, e:2 }, function(err, fix) {
      if (fix) {
        browser = fix.b[0];
        primaryEmail = {
          email: fix.e[0],
          pass: fix.e[0].split('@')[0],
        };
        secondPrimaryEmail = {
          email: fix.e[1],
          pass: fix.e[1].split('@')[0],
        };
      }
      done(err);
    });
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
      .wtype(CSS['dialog'].emailInput, primaryEmail.email)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      .wtype(CSS['eyedee.me'].newPassword, primaryEmail.pass)
      .wclick(CSS['eyedee.me'].createAccountButton)
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, primaryEmail.email));
      });
  },
  "add a primary email to the account": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].useNewEmail)
      .wtype(CSS['dialog'].newEmail, secondPrimaryEmail.email)
      .wclick(CSS['dialog'].addNewEmailButton)
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      .wtype(CSS['eyedee.me'].newPassword, secondPrimaryEmail.pass)
      .wclick(CSS['eyedee.me'].createAccountButton)
      .wclickIfExists(CSS['dialog'].notMyComputerButton)
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, secondPrimaryEmail.email))
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
  cleanup: function(done) { testSetup.teardown(done) }
});
