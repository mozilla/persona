#!/usr/bin/env node
/*jshint sub:true */

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
runner = require('../lib/runner.js'),
testSetup = require('../lib/test-setup.js'),
user = require('../lib/user.js');

var browser,
    primaryEmail,
    secondPrimaryEmail;

runner.run(module, {
  "setup all the things": function(done) {
    testSetup.setup({ b:1, e:2 }, function(err, fix) {
      browser = fix.b[0];
      primaryEmail = {
        email: fix.e[0],
        pass: fix.e[0].split('@')[0],
      };
      secondPrimaryEmail = {
        email: fix.e[1],
        pass: fix.e[1].split('@')[0],
      };
      done(err);
    });
  },
  //XXX figure out how to parameterize the RP
  "start the session": function(done) {
    browser.newSession(testSetup.sessionOpts, done);
  },
  //XXX obviously in need of refactoring between this primary and the second one.
  "signup a new account with a primary": function(done) {
    browser.chain()
      .get(persona_urls["123done"])
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wtype(CSS['dialog'].emailInput, primaryEmail.email)
      .wclick(CSS['dialog'].newEmailNextButton)
      // The click on verifyWithPrimaryButton seems stable if we do it this way
      // The problem with firing a second click just in case, is that if the
      // first wclick worked, then the the element is gone and the second wclick
      // spins for 20 seconds needlessly. Of course, this "fix" doesn't really
      // make sense to me, since wclick implicitly calls wfind first o_O.
      .wfind(CSS['dialog'].verifyWithPrimaryButton)
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      // continuing past that button
      .wtype(CSS['eyedee.me'].newPassword, primaryEmail.pass)
      .wclick(CSS['eyedee.me'].createAccountButton)
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, primaryEmail.email);
        done();
      });
  },
  "add a primary email to the account": function(done) {
    browser.chain()
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].useNewEmail)
      .wtype(CSS['dialog'].newEmail, secondPrimaryEmail.email)
      .wclick(CSS['dialog'].addNewEmailButton)
      // The click on verifyWithPrimaryButton seems stable if we do it this way
      // The problem with firing a second click just in case, is that if the
      // first wclick worked, then the the element is gone and the second wclick
      // spins for 20 seconds needlessly. Of course, this "fix" doesn't really
      // make sense to me, since wclick implicitly calls wfind first o_O.
      .wfind(CSS['dialog'].verifyWithPrimaryButton)
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      // continuing past that button
      .wtype(CSS['eyedee.me'].newPassword, secondPrimaryEmail.pass)
      .wclick(CSS['eyedee.me'].createAccountButton)
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, secondPrimaryEmail.email);
        done();
      });
  },
  //XXX This could be much more comprehensive by bringing up the dialog
  // again and checking the listed users, etc.
  "shut down remaining browsers": function(done) {
    browser.quit(done);
  }
});
