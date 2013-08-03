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
    secondaryEmail;

runner.run(module, {
  "setup all the things": function(done) {
    testSetup.setup({ b:1, p:1, testidps:1 }, function(err, fix) {
      if (fix) {
        browser = fix.b[0];
        secondaryEmail = fix.p[0];
        testIdp = fix.testidps[0];
        primaryEmail = testIdp.getRandomEmail();
      }
      done(err);
    });
  },

  "enable primary support": function(done) {
    testIdp.enableSupport(done);
  },

  //XXX figure out how to parameterize the RP
  "sign up as a secondary user": function(done) {
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
  "sign in with the personatestuser account": function(done) {
    dialog.signInExistingUser({
      browser: browser,
      email: secondaryEmail.email,
      password: secondaryEmail.pass
    }, done);
  },
  "verify signed in to 123done": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, secondaryEmail.email));
       });
  },
  "add a primary email to the account": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].useNewEmail)
      .wtype(CSS['dialog'].newEmail, primaryEmail)
      .wclick(CSS['dialog'].addNewEmailButton)
      .wclick(CSS['testidp.org'].loginButton)
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, primaryEmail));
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
